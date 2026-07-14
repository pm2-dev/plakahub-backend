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
  const { instagram, twitter, tiktok } = req.body;

  const profiles: { platform: "INSTAGRAM" | "TWITTER" | "TIKTOK"; username: string }[] = [];

  if (instagram?.trim()) profiles.push({ platform: "INSTAGRAM", username: instagram.trim() });
  if (twitter?.trim()) profiles.push({ platform: "TWITTER", username: twitter.trim() });
  if (tiktok?.trim()) profiles.push({ platform: "TIKTOK", username: tiktok.trim() });

  await prisma.$transaction(async (tx) => {
    await tx.socialProfile.deleteMany({ where: { userId } });

    if (profiles.length > 0) {
      await tx.socialProfile.createMany({
        data: profiles.map((p) => ({
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

export default router;
