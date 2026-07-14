import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seed verileri ekleniyor...");

  await prisma.socialProfile.deleteMany();
  await prisma.plate.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("Test1234!", 12);

  const adminPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@plakahub.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const user1 = await prisma.user.create({
    data: {
      email: "ahmet@plakahub.com",
      password: hashedPassword,
      plates: {
        create: {
          plateNumber: "34TEST11",
          isVerified: true,
        },
      },
      socialProfiles: {
        create: [
          { platform: "INSTAGRAM", username: "ahmet_plakahub" },
          { platform: "TWITTER", username: "ahmet_ph" },
        ],
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "zeynep@plakahub.com",
      password: hashedPassword,
      plates: {
        create: {
          plateNumber: "06KAYIT22",
          isVerified: false,
        },
      },
      socialProfiles: {
        create: [
          { platform: "TIKTOK", username: "zeynep_06" },
        ],
      },
    },
  });

  console.log(`Admin: ${admin.email} — Rol: ${admin.role}`);
  console.log(`Kullanıcı 1: ${user1.email} — Plaka: 34TEST11 (doğrulanmış)`);
  console.log(`Kullanıcı 2: ${user2.email} — Plaka: 06KAYIT22 (doğrulanmamış)`);
  console.log("Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error("Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
