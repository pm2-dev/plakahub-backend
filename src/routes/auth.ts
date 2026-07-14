import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";

const router = Router();

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password, plateNumber } = req.body;

  if (!email || !password || !plateNumber) {
    res.status(400).json({
      success: false,
      message: "email, password ve plateNumber alanları zorunludur.",
    });
    return;
  }

  const normalizedPlate = plateNumber.replace(/\s+/g, "").toUpperCase();

  const existingPlate = await prisma.plate.findUnique({
    where: { plateNumber: normalizedPlate },
  });

  if (existingPlate) {
    res.status(409).json({
      success: false,
      message: "Bu plaka zaten başka bir kullanıcı tarafından sahiplenilmiş.",
    });
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(409).json({
      success: false,
      message: "Bu e-posta adresi ile zaten bir hesap mevcut.",
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    await tx.plate.create({
      data: {
        plateNumber: normalizedPlate,
        userId: user.id,
      },
    });
  });

  res.status(201).json({
    success: true,
    message: "Kayıt başarılı, plaka eklendi.",
  });
});

export default router;
