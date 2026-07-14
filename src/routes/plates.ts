import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma";

const router = Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    found: false,
    error: "Çok fazla sorgu yaptınız, lütfen 1 dakika bekleyin.",
  },
});

router.get("/search/:plateNumber", searchLimiter, async (req: Request<{ plateNumber: string }>, res: Response): Promise<void> => {
  const raw = req.params.plateNumber;
  const normalized = raw.replace(/\s+/g, "").toUpperCase();

  const plate = await prisma.plate.findUnique({
    where: { plateNumber: normalized },
    include: {
      user: {
        select: {
          carBrand: true,
          carModel: true,
          carYear: true,
          avatarUrl: true,
          socialProfiles: {
            where: { isHidden: false },
            select: {
              platform: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (!plate) {
    res.json({ found: false, plateNumber: normalized });
    return;
  }

  const isProfileComplete = !!(plate.user.carBrand && plate.user.carModel && plate.user.carYear);

  res.json({
    found: true,
    plateNumber: plate.plateNumber,
    isVerified: plate.isVerified,
    userId: plate.userId,
    isProfileComplete,
    avatarUrl: plate.user.avatarUrl,
    carBrand: plate.user.carBrand,
    carModel: plate.user.carModel,
    carYear: plate.user.carYear,
    socialProfiles: isProfileComplete ? plate.user.socialProfiles : [],
  });
});

export default router;
