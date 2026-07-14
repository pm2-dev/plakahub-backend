import { Router, Request, Response } from "express";
import { authenticateToken, isAdmin } from "../middlewares/auth";
import prisma from "../lib/prisma";

const router = Router();

router.use(authenticateToken, isAdmin);

router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  const [totalUsers, totalPlates, verifiedPlates, pendingReports] = await Promise.all([
    prisma.user.count(),
    prisma.plate.count(),
    prisma.plate.count({ where: { isVerified: true } }),
    prisma.report.count({ where: { status: "PENDING" } }),
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalPlates,
      verifiedPlates,
      unverifiedPlates: totalPlates - verifiedPlates,
      pendingReports,
    },
  });
});

router.get("/users", async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { plates: true } },
    },
  });

  res.json({ success: true, users });
});

router.delete("/users/:id", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
    return;
  }

  await prisma.user.delete({ where: { id } });

  res.json({ success: true, message: "Kullanıcı ve bağlı plakaları silindi." });
});

router.get("/plates", async (_req: Request, res: Response): Promise<void> => {
  const plates = await prisma.plate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  res.json({ success: true, plates });
});

router.patch("/plates/:id/verify", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  const plate = await prisma.plate.findUnique({ where: { id } });

  if (!plate) {
    res.status(404).json({ success: false, message: "Plaka bulunamadı." });
    return;
  }

  const updated = await prisma.plate.update({
    where: { id },
    data: { isVerified: !plate.isVerified },
  });

  res.json({
    success: true,
    message: updated.isVerified ? "Plaka doğrulandı." : "Plaka doğrulaması kaldırıldı.",
    isVerified: updated.isVerified,
  });
});

router.get("/reports", async (req: Request, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;

  const where = status ? { status: status as "PENDING" | "REVIEWED" | "DISMISSED" } : {};

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      reporter: {
        select: { id: true, email: true, plates: { select: { plateNumber: true } } },
      },
      reportedUser: {
        select: { id: true, email: true, plates: { select: { plateNumber: true } } },
      },
      conversation: {
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              content: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  res.json({ success: true, reports });
});

router.patch("/reports/:id", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  if (!status || !["REVIEWED", "DISMISSED"].includes(status)) {
    res.status(400).json({ success: false, message: "Gecerli bir durum secin: REVIEWED veya DISMISSED." });
    return;
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    res.status(404).json({ success: false, message: "Rapor bulunamadi." });
    return;
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status,
      adminNote: adminNote || null,
    },
  });

  res.json({ success: true, report: updated });
});

router.delete("/plates/:id", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  const plate = await prisma.plate.findUnique({ where: { id } });

  if (!plate) {
    res.status(404).json({ success: false, message: "Plaka bulunamadı." });
    return;
  }

  await prisma.plate.delete({ where: { id } });

  res.json({ success: true, message: "Plaka silindi." });
});

export default router;
