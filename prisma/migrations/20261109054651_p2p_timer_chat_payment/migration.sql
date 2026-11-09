-- CreateEnum
CREATE TYPE "P2PChatRole" AS ENUM ('ASSISTANT', 'BUYER', 'SELLER', 'SYSTEM');

-- AlterEnum
ALTER TYPE "P2POrderStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "P2POrder" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "feeGHS" DECIMAL(32,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "P2PChatMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "role" "P2PChatRole" NOT NULL,
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "P2PChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "P2PChatMessage_orderId_createdAt_idx" ON "P2PChatMessage"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "P2POrder_status_expiresAt_idx" ON "P2POrder"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "P2PChatMessage" ADD CONSTRAINT "P2PChatMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "P2POrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
