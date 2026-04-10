import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.questTemplate.count();
  console.log(`Quest templates count: ${count}`);
  const templates = await prisma.questTemplate.findMany({ take: 5 });
  console.log(JSON.stringify(templates, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
