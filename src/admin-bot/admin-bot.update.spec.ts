import { Test, TestingModule } from '@nestjs/testing';
import { AdminBotUpdate } from './admin-bot.update';
import { AdminBotService } from './admin-bot.service';
import { ClientBotService } from '../client-bot/client-bot.service';
import { PrismaService } from '../prisma/prisma.service';
import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
import { getBotToken } from 'nestjs-telegraf';

describe('AdminBotUpdate', () => {
  let adminBotUpdate: AdminBotUpdate;
  let prismaService: PrismaService;
  let adminBotService: AdminBotService;
  let clientBotService: ClientBotService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAdminBotService = {};

  const mockClientBotService = {
    sendOrderStatusUpdate: jest.fn(),
  };

  const mockBot = {} as Telegraf<BotContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBotUpdate,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AdminBotService,
          useValue: mockAdminBotService,
        },
        {
          provide: ClientBotService,
          useValue: mockClientBotService,
        },
        {
          provide: getBotToken('admin'),
          useValue: mockBot,
        },
      ],
    }).compile();

    adminBotUpdate = module.get<AdminBotUpdate>(AdminBotUpdate);
    prismaService = module.get<PrismaService>(PrismaService);
    adminBotService = module.get<AdminBotService>(AdminBotService);
    clientBotService = module.get<ClientBotService>(ClientBotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onStart', () => {
    it('should create admin user if not exists', async () => {
      const mockCtx = {
        from: { id: 123456, username: 'admin' },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        username: 'admin',
        role: 'ADMIN',
      });

      await adminBotUpdate.onStart(mockCtx);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: '123456',
          username: 'admin',
          role: 'ADMIN',
        },
      });
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Админ-панель'),
        expect.anything(),
      );
    });

    it('should deny access if user is not admin', async () => {
      const mockCtx = {
        from: { id: 123456 },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'CLIENT',
      });

      await adminBotUpdate.onStart(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ У вас нет доступа к админ-панели.');
    });

    it('should show admin panel if user is admin', async () => {
      const mockCtx = {
        from: { id: 123456 },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      await adminBotUpdate.onStart(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Админ-панель'),
        expect.anything(),
      );
    });
  });

  describe('onStockCommand', () => {
    it('should show stock list for admin', async () => {
      const mockCtx = {
        from: { id: 123456 },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
        {
          id: 'uuid-2',
          name: 'Огурцы',
          price: 2.8,
          stock: 150,
          isActive: false,
        },
      ]);

      await adminBotUpdate.onStockCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Помидоры'));
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Огурцы'));
    });

    it('should deny access for non-admin', async () => {
      const mockCtx = {
        from: { id: 123456 },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'CLIENT',
      });

      await adminBotUpdate.onStockCommand(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ У вас нет доступа к этой команде.');
    });
  });

  describe('onAcceptOrder', () => {
    it('should accept order and notify client', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'accept_order-uuid-1' },
        answerCbQuery: jest.fn(),
        editMessageReplyMarkup: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-uuid-1',
        user: { telegramId: '789' },
      });

      mockPrismaService.order.update.mockResolvedValue({});

      await adminBotUpdate.onAcceptOrder(mockCtx);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { status: 'ACCEPTED' },
      });
      expect(mockClientBotService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        789,
        'order-uuid-1',
        'ACCEPTED',
      );
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('✅ Заказ принят');
    });

    it('should deny access for non-admin', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'accept_order-uuid-1' },
        answerCbQuery: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'CLIENT',
      });

      await adminBotUpdate.onAcceptOrder(mockCtx);

      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('❌ Нет доступа');
    });
  });

  describe('onCancelOrder', () => {
    it('should cancel order and notify client', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'cancel_order-uuid-1' },
        answerCbQuery: jest.fn(),
        editMessageReplyMarkup: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-uuid-1',
        user: { telegramId: '789' },
      });

      mockPrismaService.order.update.mockResolvedValue({});

      await adminBotUpdate.onCancelOrder(mockCtx);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { status: 'CANCELLED' },
      });
      expect(mockClientBotService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        789,
        'order-uuid-1',
        'CANCELLED',
      );
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('❌ Заказ отменен');
    });
  });

  describe('onCompleteOrder', () => {
    it('should complete order and notify client', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'complete_order-uuid-1' },
        answerCbQuery: jest.fn(),
        editMessageReplyMarkup: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-uuid-1',
        user: { telegramId: '789' },
      });

      mockPrismaService.order.update.mockResolvedValue({});

      await adminBotUpdate.onCompleteOrder(mockCtx);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { status: 'COMPLETED' },
      });
      expect(mockClientBotService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        789,
        'order-uuid-1',
        'COMPLETED',
      );
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('🎉 Заказ завершен');
    });
  });

  describe('onToggleProduct', () => {
    it('should toggle product active status', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'toggle_product-uuid-1' },
        answerCbQuery: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-uuid-1',
        isActive: true,
      });

      mockPrismaService.product.update.mockResolvedValue({});

      await adminBotUpdate.onToggleProduct(mockCtx);

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { isActive: false },
      });
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('❌ Товар деактивирован');
    });
  });

  describe('onEditPrice', () => {
    it('should set editing mode for price', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'edit_price_product-uuid-1' },
        session: {},
        answerCbQuery: jest.fn(),
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      await adminBotUpdate.onEditPrice(mockCtx);

      expect(mockCtx.session.editingProduct).toBe('product-uuid-1');
      expect(mockCtx.session.editingField).toBe('price');
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('новую цену'));
    });
  });

  describe('onEditStock', () => {
    it('should set editing mode for stock', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: { data: 'edit_stock_product-uuid-1' },
        session: {},
        answerCbQuery: jest.fn(),
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      await adminBotUpdate.onEditStock(mockCtx);

      expect(mockCtx.session.editingProduct).toBe('product-uuid-1');
      expect(mockCtx.session.editingField).toBe('stock');
      expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('новое количество'));
    });
  });

  describe('onText', () => {
    it('should show stock list when "📦 Товары на складе" is clicked', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '📦 Товары на складе' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      ]);

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Товары на складе'),
      );
    });

    it('should show accepted orders when "✅ Принятые заказы" is clicked', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '✅ Принятые заказы' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.order.findMany.mockResolvedValue([
        {
          id: 'order-uuid-1',
          status: 'ACCEPTED',
          user: {
            username: 'testuser',
            phone: '+375291234567',
          },
          address: 'Минск',
          totalAmount: 10.5,
          orderItems: [
            {
              product: { name: 'Помидоры' },
              quantity: 2,
            },
          ],
        },
      ]);

      await adminBotUpdate.onText(mockCtx);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { status: 'ACCEPTED' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should show cancelled orders when "❌ Отклоненные заказы" is clicked', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '❌ Отклоненные заказы' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.order.findMany.mockResolvedValue([]);

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Нет отклоненных заказов.');
    });

    it('should show "in development" for add product', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '➕ Добавить товар' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Шаг 1/3: Введите название товара'),
        expect.any(Object),
      );
      expect(mockCtx.session.addingProduct).toEqual({ step: 'name' });
    });

    it('should show products for edit when "✏️ Изменить товар" is clicked', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '✏️ Изменить товар' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
        },
      ]);

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Выберите товар для редактирования:');
    });

    it('should handle product price editing', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '4.50' },
        session: {
          editingProduct: 'product-uuid-1',
          editingField: 'price',
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-uuid-1',
        name: 'Помидоры',
      });

      mockPrismaService.product.update.mockResolvedValue({});

      await adminBotUpdate.onText(mockCtx);

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { price: 4.5 },
      });
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Цена товара "Помидоры" обновлена: 4.5 BYN'),
      );
    });

    it('should handle product stock editing', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '150' },
        session: {
          editingProduct: 'product-uuid-1',
          editingField: 'stock',
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-uuid-1',
        name: 'Помидоры',
      });

      mockPrismaService.product.update.mockResolvedValue({});

      await adminBotUpdate.onText(mockCtx);

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-uuid-1' },
        data: { stock: 150 },
      });
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Остаток товара "Помидоры" обновлен: 150 шт.'),
      );
    });

    it('should reject invalid price format', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: 'invalid' },
        session: {
          editingProduct: 'product-uuid-1',
          editingField: 'price',
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-uuid-1',
        name: 'Помидоры',
      });

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Неверный формат цены'),
      );
    });

    it('should reject invalid stock format', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '-10' },
        session: {
          editingProduct: 'product-uuid-1',
          editingField: 'stock',
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-uuid-1',
        name: 'Помидоры',
      });

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Неверный формат количества'),
      );
    });

    it('should deny access to non-admin users', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '📦 Товары на складе' },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'CLIENT',
      });

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ У вас нет доступа к админ-панели.');
    });
  });

  describe('showStockList', () => {
    it('should show empty message when no products', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '📦 Товары на складе' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.product.findMany.mockResolvedValue([]);

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Товары отсутствуют.');
    });
  });

  describe('showAcceptedOrders', () => {
    it('should show no orders message', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '✅ Принятые заказы' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        role: 'ADMIN',
      });

      mockPrismaService.order.findMany.mockResolvedValue([]);

      await adminBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Нет принятых заказов.');
    });
  });
});
