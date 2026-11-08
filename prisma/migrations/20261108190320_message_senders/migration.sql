-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "senderId" TEXT;

-- CreateTable
CREATE TABLE "MessageSender" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatarType" TEXT NOT NULL DEFAULT 'HUMAN',
    "letter" TEXT,
    "allowReplies" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageSender_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "MessageSender"("id") ON DELETE SET NULL ON UPDATE CASCADE;
