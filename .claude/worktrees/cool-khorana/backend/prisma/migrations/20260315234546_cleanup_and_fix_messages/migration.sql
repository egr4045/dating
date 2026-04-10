/*
  Warnings:

  - You are about to drop the `QuestMatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserMatches` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_matchId_fkey";

-- DropForeignKey
ALTER TABLE "_UserMatches" DROP CONSTRAINT "_UserMatches_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserMatches" DROP CONSTRAINT "_UserMatches_B_fkey";

-- DropTable
DROP TABLE "QuestMatch";

-- DropTable
DROP TABLE "_UserMatches";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "QuestLobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
