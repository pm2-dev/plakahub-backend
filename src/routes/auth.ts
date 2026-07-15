import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifySync } from "otplib";
import prisma from "../lib/prisma";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || "";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET || "";

function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

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

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const plate = await tx.plate.create({
      data: {
        plateNumber: normalizedPlate,
        userId: user.id,
      },
    });

    return { user, plate };
  });

  const token = generateToken(result.user.id, result.user.role);

  res.status(201).json({
    success: true,
    message: "Kayıt başarılı, plaka eklendi.",
    token,
    user: {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      plates: [
        {
          plateNumber: result.plate.plateNumber,
          isVerified: result.plate.isVerified,
        },
      ],
    },
  });
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      success: false,
      message: "email ve password alanları zorunludur.",
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      plates: {
        select: {
          plateNumber: true,
          isVerified: true,
        },
      },
    },
  });

  if (!user) {
    res.status(401).json({
      success: false,
      message: "E-posta veya şifre hatalı.",
    });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      message: "E-posta veya şifre hatalı.",
    });
    return;
  }

  const token = generateToken(user.id, user.role);

  res.json({
    success: true,
    message: "Giriş başarılı.",
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      plates: user.plates,
    },
  });
});

router.post("/admin-login", async (req: Request, res: Response): Promise<void> => {
  const { username, password, totpCode } = req.body;

  if (!username || !password || !totpCode) {
    res.status(400).json({ success: false, message: "Tum alanlar zorunludur." });
    return;
  }

  if (!ADMIN_PASS_HASH || !ADMIN_TOTP_SECRET) {
    res.status(500).json({ success: false, message: "Admin yapılandırması eksik." });
    return;
  }

  if (username !== ADMIN_USER) {
    res.status(401).json({ success: false, message: "Kullanici adi veya sifre hatali." });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, ADMIN_PASS_HASH);
  if (!isPasswordValid) {
    res.status(401).json({ success: false, message: "Kullanici adi veya sifre hatali." });
    return;
  }

  const isTotpValid = verifySync({ token: totpCode, secret: ADMIN_TOTP_SECRET });
  if (!isTotpValid) {
    res.status(401).json({ success: false, message: "2FA kodu gecersiz." });
    return;
  }

  const token = jwt.sign({ userId: "admin", role: "ADMIN" }, JWT_SECRET, { expiresIn: "24h" });

  res.json({
    success: true,
    message: "Giris basarili.",
    token,
    user: { id: "admin", email: ADMIN_USER, role: "ADMIN" },
  });
});

export default router;
