import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import prisma from "../lib/prisma";

const router = Router();

router.use(authenticateToken);

router.get("/profile", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
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

  res.json({ success: true, user });
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

export default router;
