-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TWITTER', 'TIKTOK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plates" (
    "id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_profiles" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plates_plate_number_key" ON "plates"("plate_number");

-- CreateIndex
CREATE INDEX "plates_plate_number_idx" ON "plates"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "social_profiles_user_id_platform_key" ON "social_profiles"("user_id", "platform");

-- AddForeignKey
ALTER TABLE "plates" ADD CONSTRAINT "plates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_profiles" ADD CONSTRAINT "social_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
