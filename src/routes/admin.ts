import { Router, Request, Response } from "express";
import { authenticateToken, isAdmin } from "../middlewares/auth";
import prisma from "../lib/prisma";

const router = Router();

router.use(authenticateToken, isAdmin);

router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const [totalUsers, totalPlates, verifiedPlates] = await Promise.all([
    prisma.user.count(),
    prisma.plate.count(),
    prisma.plate.count({ where: { isVerified: true } }),
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalPlates,
      verifiedPlates,
      unverifiedPlates: totalPlates - verifiedPlates,
    },
  });
});

export default router;
