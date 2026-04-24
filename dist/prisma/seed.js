"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/veggie_bot?schema=public';
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Seeding database...');
    const admin = await prisma.user.upsert({
        where: { telegramId: '5151069944' },
        update: {},
        create: {
            telegramId: '5151069944',
            username: 'rahunak',
            role: 'ADMIN',
        },
    });
    console.log('Admin created:', admin);
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
//# sourceMappingURL=seed.js.map