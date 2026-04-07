import { PrismaClient } from '@prisma/client';

async function check() {
  const prisma = new PrismaClient();
  const count = await prisma.questTemplate.count();
  console.log('--- DATABASE STATUS ---');
  console.log('Total Quest Templates:', count);
  
  const byCategory = await prisma.questTemplate.groupBy({
    by: ['category'],
    _count: { id: true }
  });
  console.log('By Category:', JSON.stringify(byCategory, null, 2));
  
  await prisma.$disconnect();
}

check();
