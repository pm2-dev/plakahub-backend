import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/search/:plateNumber", async (req: Request<{ plateNumber: string }>, res: Response): Promise<void> => {
  const raw = req.params.plateNumber;
  const normalized = raw.replace(/\s+/g, "").toUpperCase();

  const plate = await prisma.plate.findUnique({
    where: { plateNumber: normalized },
    include: {
      user: {
        include: {
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

  res.json({
    found: true,
    plateNumber: plate.plateNumber,
    isVerified: plate.isVerified,
    socialProfiles: plate.user.socialProfiles,
  });
});

export default router;
