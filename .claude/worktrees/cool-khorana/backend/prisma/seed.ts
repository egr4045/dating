import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const contentPath = path.join(__dirname, '../content/quests');
  const files = fs.readdirSync(contentPath);

  for (const file of files) {
    const filePath = path.join(contentPath, file);
    const quests = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const quest of quests) {
      await prisma.questTemplate.upsert({
        where: { id: quest.id },
        update: quest,
        create: quest,
      });
    }
  }
  console.log('✅ Квесты успешно загружены в базу!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());