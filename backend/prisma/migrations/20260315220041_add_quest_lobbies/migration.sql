-- CreateTable
CREATE TABLE "QuestLobby" (
    "id" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "hostId" INTEGER NOT NULL,
    "participantId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestLobby_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuestLobby" ADD CONSTRAINT "QuestLobby_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuestTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLobby" ADD CONSTRAINT "QuestLobby_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLobby" ADD CONSTRAINT "QuestLobby_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
