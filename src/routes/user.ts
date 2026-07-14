import { Router, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { authenticateToken } from "../middlewares/auth";
import prisma from "../lib/prisma";

const router = Router();

router.use(authenticateToken);

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads/avatars");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error("Sadece JPEG, PNG ve WebP formatları kabul edilir."));
      return;
    }
    cb(null, true);
  },
});

router.get("/profile", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      avatarUrl: true,
      carBrand: true,
      carModel: true,
      carYear: true,
      createdAt: true,
      plates: {
        select: {
          plateNumber: true,
          isVerified: true,
        },
      },
      socialProfiles: {
        select: {
          platform: true,
          username: true,
          isHidden: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    return;
  }

  const isProfileComplete = !!(user.carBrand && user.carModel && user.carYear);

  res.json({ success: true, user: { ...user, isProfileComplete } });
});

router.put("/socials", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { profiles: incoming } = req.body;

  if (!Array.isArray(incoming)) {
    res.status(400).json({ success: false, message: "profiles dizisi gereklidir." });
    return;
  }

  const validProfiles: { platform: string; username: string }[] = [];
  const seenPlatforms = new Set<string>();

  for (const item of incoming) {
    const platform = String(item?.platform ?? "").trim().toUpperCase();
    const username = String(item?.username ?? "").trim();

    if (!platform || !username) continue;
    if (platform.length > 50 || username.length > 100) continue;
    if (seenPlatforms.has(platform)) continue;

    seenPlatforms.add(platform);
    validProfiles.push({ platform, username });
  }

  if (validProfiles.length > 20) {
    res.status(400).json({ success: false, message: "En fazla 20 sosyal profil eklenebilir." });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.socialProfile.deleteMany({ where: { userId } });

    if (validProfiles.length > 0) {
      await tx.socialProfile.createMany({
        data: validProfiles.map((p) => ({
          userId,
          platform: p.platform,
          username: p.username,
        })),
      });
    }
  });

  const updatedProfiles = await prisma.socialProfile.findMany({
    where: { userId },
    select: { platform: true, username: true, isHidden: true },
  });

  res.json({
    success: true,
    message: "Sosyal medya profilleri güncellendi.",
    socialProfiles: updatedProfiles,
  });
});

router.put("/push-token", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ success: false, message: "Geçerli bir push token gereklidir." });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { expoPushToken: token },
  });

  res.json({ success: true, message: "Push token kaydedildi." });
});

router.post("/avatar", upload.single("avatar"), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  if (!req.file) {
    res.status(400).json({ success: false, message: "Dosya yuklenemedi." });
    return;
  }

  const filename = `${userId}_${crypto.randomBytes(8).toString("hex")}.webp`;
  const outputPath = path.join(UPLOADS_DIR, filename);

  try {
    await sharp(req.file.buffer)
      .resize(512, 512, { fit: "cover", position: "center" })
      .webp({ quality: 75 })
      .toFile(outputPath);
  } catch {
    res.status(500).json({ success: false, message: "Gorsel isleme sirasinda hata olustu." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  if (user?.avatarUrl) {
    const oldFile = path.join(UPLOADS_DIR, path.basename(user.avatarUrl));
    if (fs.existsSync(oldFile)) {
      fs.unlinkSync(oldFile);
    }
  }

  const avatarUrl = `/uploads/avatars/${filename}`;

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });

  res.json({ success: true, avatarUrl });
});

router.post("/block", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { targetUserId } = req.body;

  if (!targetUserId || typeof targetUserId !== "string") {
    res.status(400).json({ success: false, message: "targetUserId gereklidir." });
    return;
  }

  if (targetUserId === userId) {
    res.status(400).json({ success: false, message: "Kendinizi engelleyemezsiniz." });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    res.status(404).json({ success: false, message: "Kullanici bulunamadi." });
    return;
  }

  const existing = await prisma.blockedUser.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
  });

  if (existing) {
    res.status(409).json({ success: false, message: "Bu kullanici zaten engelli." });
    return;
  }

  await prisma.blockedUser.create({
    data: { blockerId: userId, blockedId: targetUserId },
  });

  res.json({ success: true, message: "Kullanici engellendi." });
});

router.delete("/block/:userId", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const targetUserId = req.params.userId;

  const existing = await prisma.blockedUser.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
  });

  if (!existing) {
    res.status(404).json({ success: false, message: "Engel kaydi bulunamadi." });
    return;
  }

  await prisma.blockedUser.delete({
    where: { id: existing.id },
  });

  res.json({ success: true, message: "Engel kaldirildi." });
});

router.get("/blocks", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const blocks = await prisma.blockedUser.findMany({
    where: { blockerId: userId },
    include: {
      blocked: {
        select: {
          id: true,
          email: true,
          avatarUrl: true,
          plates: { select: { plateNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, blocks });
});

router.get("/block-check/:userId", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const targetUserId = req.params.userId;

  const block = await prisma.blockedUser.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
  });

  res.json({ success: true, isBlocked: !!block });
});

router.put("/vehicle", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { carBrand, carModel, carYear } = req.body;

  if (!carBrand || !carModel || !carYear) {
    res.status(400).json({ success: false, message: "Arac markasi, modeli ve yili zorunludur." });
    return;
  }

  const brand = String(carBrand).trim();
  const model = String(carModel).trim();
  const year = String(carYear).trim();

  if (brand.length > 50 || model.length > 50) {
    res.status(400).json({ success: false, message: "Marka ve model en fazla 50 karakter olabilir." });
    return;
  }

  const yearNum = Number(year);
  if (isNaN(yearNum) || yearNum < 1950 || yearNum > new Date().getFullYear() + 1) {
    res.status(400).json({ success: false, message: "Gecerli bir yil giriniz." });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { carBrand: brand, carModel: model, carYear: year },
  });

  res.json({ success: true, message: "Arac bilgileri guncellendi." });
});

export default router;
