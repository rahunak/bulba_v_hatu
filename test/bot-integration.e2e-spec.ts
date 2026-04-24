import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Bot Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Очистка базы данных перед каждым тестом
    await prismaService.orderItem.deleteMany();
    await prismaService.order.deleteMany();
    await prismaService.product.deleteMany();
    await prismaService.user.deleteMany();
    await prismaService.session.deleteMany();
  });

  describe('Client Bot Flow', () => {
    it('should create new client user on start', async () => {
      const user = await prismaService.user.create({
        data: {
          telegramId: '123456',
          username: 'testclient',
          role: 'CLIENT',
        },
      });

      expect(user).toBeDefined();
      expect(user.role).toBe('CLIENT');
      expect(user.telegramId).toBe('123456');
    });

    it('should allow client to view products', async () => {
      await prismaService.product.createMany({
        data: [
          {
            name: 'Помидоры',
            price: 3.5,
            stock: 100,
            isActive: true,
          },
          {
            name: 'Огурцы',
            price: 2.8,
            stock: 150,
            isActive: true,
          },
        ],
      });

      const products = await prismaService.product.findMany({
        where: { isActive: true, stock: { gt: 0 } },
      });

      expect(products).toHaveLength(2);
      expect(products[0].name).toBe('Помидоры');
    });

    it('should create order with items', async () => {
      const user = await prismaService.user.create({
        data: {
          telegramId: '123456',
          username: 'testclient',
          role: 'CLIENT',
          phone: '+375291234567',
        },
      });

      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      const order = await prismaService.order.create({
        data: {
          userId: user.id,
          address: 'Минск, ул. Ленина 1',
          totalAmount: 7.0,
          status: 'PENDING',
          orderItems: {
            create: [
              {
                productId: product.id,
                quantity: 2,
                price: 3.5,
              },
            ],
          },
        },
        include: {
          orderItems: true,
        },
      });

      expect(order).toBeDefined();
      expect(order.status).toBe('PENDING');
      expect(order.orderItems).toHaveLength(1);
      expect(order.orderItems[0].quantity).toBe(2);
    });

    it('should decrease product stock after order', async () => {
      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      await prismaService.product.update({
        where: { id: product.id },
        data: {
          stock: {
            decrement: 10,
          },
        },
      });

      const updatedProduct = await prismaService.product.findUnique({
        where: { id: product.id },
      });

      expect(updatedProduct?.stock).toBe(90);
    });
  });

  describe('Admin Bot Flow', () => {
    it('should create admin user on start', async () => {
      const admin = await prismaService.user.create({
        data: {
          telegramId: '5151069944',
          username: 'admin',
          role: 'ADMIN',
        },
      });

      expect(admin).toBeDefined();
      expect(admin.role).toBe('ADMIN');
    });

    it('should allow admin to view all orders', async () => {
      const client = await prismaService.user.create({
        data: {
          telegramId: '123456',
          username: 'client',
          role: 'CLIENT',
        },
      });

      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      await prismaService.order.create({
        data: {
          userId: client.id,
          address: 'Минск, ул. Ленина 1',
          totalAmount: 7.0,
          status: 'PENDING',
          orderItems: {
            create: [
              {
                productId: product.id,
                quantity: 2,
                price: 3.5,
              },
            ],
          },
        },
      });

      const orders = await prismaService.order.findMany({
        where: { status: 'PENDING' },
        include: {
          user: true,
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe('PENDING');
      expect(orders[0].user.telegramId).toBe('123456');
    });

    it('should allow admin to accept order', async () => {
      const client = await prismaService.user.create({
        data: {
          telegramId: '123456',
          username: 'client',
          role: 'CLIENT',
        },
      });

      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      const order = await prismaService.order.create({
        data: {
          userId: client.id,
          address: 'Минск, ул. Ленина 1',
          totalAmount: 7.0,
          status: 'PENDING',
          orderItems: {
            create: [
              {
                productId: product.id,
                quantity: 2,
                price: 3.5,
              },
            ],
          },
        },
      });

      const updatedOrder = await prismaService.order.update({
        where: { id: order.id },
        data: { status: 'ACCEPTED' },
      });

      expect(updatedOrder.status).toBe('ACCEPTED');
    });

    it('should allow admin to update product price', async () => {
      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      const updatedProduct = await prismaService.product.update({
        where: { id: product.id },
        data: { price: 4.0 },
      });

      expect(updatedProduct.price.toString()).toBe('4');
    });

    it('should allow admin to update product stock', async () => {
      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      const updatedProduct = await prismaService.product.update({
        where: { id: product.id },
        data: { stock: 150 },
      });

      expect(updatedProduct.stock).toBe(150);
    });

    it('should allow admin to toggle product active status', async () => {
      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      const updatedProduct = await prismaService.product.update({
        where: { id: product.id },
        data: { isActive: false },
      });

      expect(updatedProduct.isActive).toBe(false);
    });
  });

  describe('Order Lifecycle', () => {
    it('should complete full order lifecycle', async () => {
      // 1. Создаем клиента
      const client = await prismaService.user.create({
        data: {
          telegramId: '123456',
          username: 'client',
          role: 'CLIENT',
          phone: '+375291234567',
        },
      });

      // 2. Создаем товар
      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      // 3. Клиент создает заказ
      const order = await prismaService.order.create({
        data: {
          userId: client.id,
          address: 'Минск, ул. Ленина 1',
          totalAmount: 7.0,
          status: 'PENDING',
          orderItems: {
            create: [
              {
                productId: product.id,
                quantity: 2,
                price: 3.5,
              },
            ],
          },
        },
      });

      expect(order.status).toBe('PENDING');

      // 4. Админ принимает заказ
      const acceptedOrder = await prismaService.order.update({
        where: { id: order.id },
        data: { status: 'ACCEPTED' },
      });

      expect(acceptedOrder.status).toBe('ACCEPTED');

      // 5. Админ завершает заказ
      const completedOrder = await prismaService.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' },
      });

      expect(completedOrder.status).toBe('COMPLETED');
    });

    it('should handle order cancellation', async () => {
      const client = await prismaService.user.create({
        data: {
          telegramId: '123456',
          username: 'client',
          role: 'CLIENT',
        },
      });

      const product = await prismaService.product.create({
        data: {
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      });

      const order = await prismaService.order.create({
        data: {
          userId: client.id,
          address: 'Минск, ул. Ленина 1',
          totalAmount: 7.0,
          status: 'PENDING',
          orderItems: {
            create: [
              {
                productId: product.id,
                quantity: 2,
                price: 3.5,
              },
            ],
          },
        },
      });

      const cancelledOrder = await prismaService.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      expect(cancelledOrder.status).toBe('CANCELLED');
    });
  });

  describe('Session Management', () => {
    it('should create and retrieve session', async () => {
      const session = await prismaService.session.create({
        data: {
          telegramId: '123456',
          sessionData: { cart: [] },
        },
      });

      expect(session).toBeDefined();
      expect(session.telegramId).toBe('123456');

      const retrieved = await prismaService.session.findUnique({
        where: { telegramId: '123456' },
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionData).toEqual({ cart: [] });
    });

    it('should update session data', async () => {
      await prismaService.session.create({
        data: {
          telegramId: '123456',
          sessionData: { cart: [] },
        },
      });

      const updated = await prismaService.session.update({
        where: { telegramId: '123456' },
        data: {
          sessionData: {
            cart: [{ productId: 'uuid-1', quantity: 2 }],
          },
        },
      });

      expect(updated.sessionData).toEqual({
        cart: [{ productId: 'uuid-1', quantity: 2 }],
      });
    });
  });
});
