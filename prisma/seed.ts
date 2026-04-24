import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/veggie_bot?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Создаем админа (замените telegramId на ваш реальный ID)
  const admin = await prisma.user.upsert({
    where: { telegramId: '123456789' },
    update: {},
    create: {
      telegramId: '123456789',
      username: 'admin',
      role: 'ADMIN',
    },
  });
  console.log('Admin created:', admin);

  // Создаем товары
  const products = [
    {
      name: 'Помидоры',
      price: 3.50,
      stock: 100,
      isActive: true,
    },
    {
      name: 'Огурцы',
      price: 2.80,
      stock: 150,
      isActive: true,
    },
    {
      name: 'Картофель',
      price: 1.50,
      stock: 200,
      isActive: true,
    },
    {
      name: 'Морковь',
      price: 2.00,
      stock: 120,
      isActive: true,
    },
    {
      name: 'Капуста',
      price: 2.50,
      stock: 80,
      isActive: true,
    },
  ];

  for (const product of products) {
    const created = await prisma.product.create({
      data: product,
    });
    console.log('Product created:', created.name);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
