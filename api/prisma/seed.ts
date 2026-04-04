import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('testpassword123', 12);

  await prisma.user.upsert({
    where: { email: 'test@honkler.dev' },
    update: {},
    create: {
      email: 'test@honkler.dev',
      passwordHash,
      displayName: 'Test User',
    },
  });

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
