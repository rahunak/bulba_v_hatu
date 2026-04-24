import { Test, TestingModule } from '@nestjs/testing';
import { ClientBotUpdate } from './client-bot.update';
import { ClientBotService } from './client-bot.service';
import { AdminBotService } from '../admin-bot/admin-bot.service';
import { PrismaService } from '../prisma/prisma.service';
import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
import { getBotToken } from 'nestjs-telegraf';

describe('ClientBotUpdate', () => {
  let clientBotUpdate: ClientBotUpdate;
  let prismaService: PrismaService;
  let clientBotService: ClientBotService;
  let adminBotService: AdminBotService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockClientBotService = {
    sendOrderConfirmation: jest.fn(),
  };

  const mockAdminBotService = {
    notifyNewOrder: jest.fn(),
  };

  const mockBot = {} as Telegraf<BotContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientBotUpdate,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ClientBotService,
          useValue: mockClientBotService,
        },
        {
          provide: AdminBotService,
          useValue: mockAdminBotService,
        },
        {
          provide: getBotToken('client'),
          useValue: mockBot,
        },
      ],
    }).compile();

    clientBotUpdate = module.get<ClientBotUpdate>(ClientBotUpdate);
    prismaService = module.get<PrismaService>(PrismaService);
    clientBotService = module.get<ClientBotService>(ClientBotService);
    adminBotService = module.get<AdminBotService>(AdminBotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onStart', () => {
    it('should create new user if not exists', async () => {
      const mockCtx = {
        from: { id: 123456, username: 'testuser' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        username: 'testuser',
        role: 'CLIENT',
      });

      await clientBotUpdate.onStart(mockCtx);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: '123456',
          username: 'testuser',
          role: 'CLIENT',
        },
      });
      expect(mockCtx.session.cart).toEqual([]);
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should not create user if already exists', async () => {
      const mockCtx = {
        from: { id: 123456, username: 'testuser' },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        username: 'testuser',
        role: 'CLIENT',
      });

      await clientBotUpdate.onStart(mockCtx);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      expect(mockCtx.session.cart).toEqual([]);
    });
  });

  describe('onAddToCart', () => {
    it('should add new product to cart', async () => {
      const mockCtx = {
        callbackQuery: { data: 'add_product-uuid-1' },
        session: { cart: [] },
        answerCbQuery: jest.fn(),
      } as any;

      await clientBotUpdate.onAddToCart(mockCtx);

      expect(mockCtx.session.cart).toHaveLength(1);
      expect(mockCtx.session.cart[0]).toEqual({
        productId: 'product-uuid-1',
        quantity: 1,
      });
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('✅ Товар добавлен в корзину');
    });

    it('should increment quantity if product already in cart', async () => {
      const mockCtx = {
        callbackQuery: { data: 'add_product-uuid-1' },
        session: {
          cart: [{ productId: 'product-uuid-1', quantity: 2 }],
        },
        answerCbQuery: jest.fn(),
      } as any;

      await clientBotUpdate.onAddToCart(mockCtx);

      expect(mockCtx.session.cart).toHaveLength(1);
      expect(mockCtx.session.cart[0].quantity).toBe(3);
    });

    it('should update message text after adding to cart', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'add_uuid-1',
          message: {},
        },
        session: { cart: [] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: null,
      });

      await clientBotUpdate.onAddToCart(mockCtx);

      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('В корзине: 1 шт'),
        expect.any(Object),
      );
    });

    it('should update message caption for photo after adding to cart', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'add_uuid-1',
          message: {},
        },
        session: { cart: [] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: 'photo-123',
      });

      await clientBotUpdate.onAddToCart(mockCtx);

      expect(mockCtx.editMessageCaption).toHaveBeenCalledWith(
        expect.stringContaining('В корзине: 1 шт'),
        expect.any(Object),
      );
    });

    it('should show +/- buttons after adding to cart', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'add_uuid-1',
          message: {},
        },
        session: { cart: [{ productId: 'uuid-1', quantity: 1 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: null,
      });

      await clientBotUpdate.onAddToCart(mockCtx);

      const callArgs = mockCtx.editMessageText.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('reply_markup');
    });
  });

  describe('onCheckout', () => {
    it('should ask for phone if user has no phone', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: {},
        session: { cart: [{ productId: 'uuid-1', quantity: 1 }] },
        reply: jest.fn(),
        answerCbQuery: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        phone: null,
      });

      await clientBotUpdate.onCheckout(mockCtx);

      expect(mockCtx.session.orderStep).toBe('awaiting_phone');
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should ask for address if user has phone', async () => {
      const mockCtx = {
        from: { id: 123456 },
        callbackQuery: {},
        session: { cart: [{ productId: 'uuid-1', quantity: 1 }] },
        reply: jest.fn(),
        answerCbQuery: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        phone: '+375291234567',
      });

      await clientBotUpdate.onCheckout(mockCtx);

      expect(mockCtx.session.orderStep).toBe('awaiting_address');
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should not checkout if cart is empty', async () => {
      const mockCtx = {
        callbackQuery: {},
        session: { cart: [] },
        answerCbQuery: jest.fn(),
      } as any;

      await clientBotUpdate.onCheckout(mockCtx);

      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Корзина пуста');
    });
  });

  describe('onClearCart', () => {
    it('should clear cart', async () => {
      const mockCtx = {
        session: { cart: [{ productId: 'uuid-1', quantity: 2 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
      } as any;

      await clientBotUpdate.onClearCart(mockCtx);

      expect(mockCtx.session.cart).toEqual([]);
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('🗑 Корзина очищена');
      expect(mockCtx.editMessageText).toHaveBeenCalledWith('🛒 Корзина очищена.');
    });
  });

  describe('onRemoveFromCart', () => {
    it('should decrease quantity when more than 1', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'remove_uuid-1',
          message: {},
        },
        session: { cart: [{ productId: 'uuid-1', quantity: 3 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: null,
      });

      await clientBotUpdate.onRemoveFromCart(mockCtx);

      expect(mockCtx.session.cart[0].quantity).toBe(2);
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('✅ Товар удален из корзины');
    });

    it('should remove item when quantity is 1', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'remove_uuid-1',
          message: {},
        },
        session: { cart: [{ productId: 'uuid-1', quantity: 1 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: null,
      });

      await clientBotUpdate.onRemoveFromCart(mockCtx);

      expect(mockCtx.session.cart).toEqual([]);
      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('✅ Товар удален из корзины');
    });

    it('should update message with new buttons after removal', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'remove_uuid-1',
          message: {},
        },
        session: { cart: [{ productId: 'uuid-1', quantity: 2 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: null,
      });

      await clientBotUpdate.onRemoveFromCart(mockCtx);

      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Помидоры'),
        expect.any(Object),
      );
    });

    it('should update photo message caption after removal', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'remove_uuid-1',
          message: {},
        },
        session: { cart: [{ productId: 'uuid-1', quantity: 2 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: 'photo-123',
      });

      await clientBotUpdate.onRemoveFromCart(mockCtx);

      expect(mockCtx.editMessageCaption).toHaveBeenCalledWith(
        expect.stringContaining('Помидоры'),
        expect.any(Object),
      );
    });

    it('should show "Add to cart" button when item fully removed', async () => {
      const mockCtx = {
        callbackQuery: {
          data: 'remove_uuid-1',
          message: {},
        },
        session: { cart: [{ productId: 'uuid-1', quantity: 1 }] },
        answerCbQuery: jest.fn(),
        editMessageText: jest.fn(),
        editMessageCaption: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
        photoId: null,
      });

      await clientBotUpdate.onRemoveFromCart(mockCtx);

      expect(mockCtx.editMessageText).toHaveBeenCalledWith(
        expect.not.stringContaining('В корзине'),
        expect.any(Object),
      );
    });
  });

  describe('onContact', () => {
    it('should save phone and ask for address', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { contact: { phone_number: '+375291234567' } },
        session: {},
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.update.mockResolvedValue({});

      await clientBotUpdate.onContact(mockCtx);

      expect(mockCtx.session.phone).toBe('+375291234567');
      expect(mockCtx.session.orderStep).toBe('awaiting_address');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
        data: { phone: '+375291234567' },
      });
      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });

  describe('onText', () => {
    it('should show catalog when "📦 Каталог товаров" is clicked', async () => {
      const mockCtx = {
        message: { text: '📦 Каталог товаров' },
        session: {},
        reply: jest.fn(),
        replyWithPhoto: jest.fn(),
      } as any;

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
          photoId: null,
        },
      ]);

      await clientBotUpdate.onText(mockCtx);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true, stock: { gt: 0 } },
      });
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should show cart when "🛒 Моя корзина" is clicked', async () => {
      const mockCtx = {
        message: { text: '🛒 Моя корзина' },
        session: {
          cart: [{ productId: 'uuid-1', quantity: 2 }],
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
      });

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Ваша корзина'),
        expect.any(Object),
      );
    });

    it('should show orders when "📋 Мои заказы" is clicked', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '📋 Мои заказы' },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        orders: [
          {
            id: 'order-uuid-1',
            status: 'PENDING',
            totalAmount: 10.5,
          },
        ],
      });

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Ваши последние заказы'),
      );
    });

    it('should handle address input when orderStep is awaiting_address', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: 'Минск, ул. Ленина 1' },
        session: {
          orderStep: 'awaiting_address',
          cart: [{ productId: 'uuid-1', quantity: 2 }],
        },
        chat: { id: 123456 },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        telegramId: '123456',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'order-uuid-1',
            }),
          },
          product: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.session.orderStep).toBeUndefined();
      expect(mockCtx.session.cart).toEqual([]);
    });

    it('should handle error when telegramId is missing during address input', async () => {
      const mockCtx = {
        from: undefined,
        message: { text: 'Минск, ул. Ленина 1' },
        session: {
          orderStep: 'awaiting_address',
          cart: [{ productId: 'uuid-1', quantity: 2 }],
        },
        reply: jest.fn(),
      } as any;

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Ошибка при оформлении заказа.');
    });

    it('should handle error when cart is empty during address input', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: 'Минск, ул. Ленина 1' },
        session: {
          orderStep: 'awaiting_address',
          cart: [],
        },
        reply: jest.fn(),
      } as any;

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Ошибка при оформлении заказа.');
    });

    it('should handle error when user not found during address input', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: 'Минск, ул. Ленина 1' },
        session: {
          orderStep: 'awaiting_address',
          cart: [{ productId: 'uuid-1', quantity: 2 }],
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Пользователь не найден.');
    });

    it('should handle error when product is out of stock during order', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: 'Минск, ул. Ленина 1' },
        session: {
          orderStep: 'awaiting_address',
          cart: [{ productId: 'uuid-1', quantity: 10 }],
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        telegramId: '123456',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 5,
      });

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Товар Помидоры недоступен в нужном количестве.');
    });

    it('should handle database error during order creation', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: 'Минск, ул. Ленина 1' },
        session: {
          orderStep: 'awaiting_address',
          cart: [{ productId: 'uuid-1', quantity: 2 }],
        },
        chat: { id: 123456 },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        telegramId: '123456',
      });

      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'uuid-1',
        name: 'Помидоры',
        price: 3.5,
        stock: 100,
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPrismaService.$transaction.mockRejectedValue(new Error('Database error'));

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('Произошла ошибка при оформлении заказа. Попробуйте позже.');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Order creation error:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('showCatalog', () => {
    it('should show empty message when no products', async () => {
      const mockCtx = {
        message: { text: '📦 Каталог товаров' },
        reply: jest.fn(),
      } as any;

      mockPrismaService.product.findMany.mockResolvedValue([]);

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        'К сожалению, товары временно отсутствуют.',
      );
    });

    it('should show product with photo', async () => {
      const mockCtx = {
        message: { text: '📦 Каталог товаров' },
        session: {},
        reply: jest.fn(),
        replyWithPhoto: jest.fn(),
      } as any;

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
          photoId: 'photo-123',
        },
      ]);

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.replyWithPhoto).toHaveBeenCalledWith(
        'photo-123',
        expect.objectContaining({
          caption: expect.stringContaining('Помидоры'),
        }),
      );
    });

    it('should show "Add to cart" button when product not in cart', async () => {
      const mockCtx = {
        message: { text: '📦 Каталог товаров' },
        session: { cart: [] },
        reply: jest.fn(),
        replyWithPhoto: jest.fn(),
      } as any;

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
          photoId: null,
        },
      ]);

      await clientBotUpdate.onText(mockCtx);

      const callArgs = mockCtx.reply.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('reply_markup');
      expect(callArgs[1].reply_markup.inline_keyboard[0][0].text).toBe('➕ Добавить в корзину');
    });

    it('should show +/- buttons when product is in cart', async () => {
      const mockCtx = {
        message: { text: '📦 Каталог товаров' },
        session: { cart: [{ productId: 'uuid-1', quantity: 2 }] },
        reply: jest.fn(),
        replyWithPhoto: jest.fn(),
      } as any;

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
          photoId: null,
        },
      ]);

      await clientBotUpdate.onText(mockCtx);

      const callArgs = mockCtx.reply.mock.calls[0];
      expect(callArgs[0]).toContain('В корзине: 2 шт');
      expect(callArgs[1].reply_markup.inline_keyboard[0]).toHaveLength(3);
      expect(callArgs[1].reply_markup.inline_keyboard[0][0].text).toBe('➖');
      expect(callArgs[1].reply_markup.inline_keyboard[0][1].text).toBe('2 шт');
      expect(callArgs[1].reply_markup.inline_keyboard[0][2].text).toBe('➕');
    });

    it('should show cart quantity in product description', async () => {
      const mockCtx = {
        message: { text: '📦 Каталог товаров' },
        session: { cart: [{ productId: 'uuid-1', quantity: 5 }] },
        reply: jest.fn(),
        replyWithPhoto: jest.fn(),
      } as any;

      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
          stock: 100,
          isActive: true,
          photoId: null,
        },
      ]);

      await clientBotUpdate.onText(mockCtx);

      const callArgs = mockCtx.reply.mock.calls[0];
      expect(callArgs[0]).toContain('🛒 В корзине: 5 шт');
    });
  });

  describe('showCart', () => {
    it('should show empty cart message', async () => {
      const mockCtx = {
        message: { text: '🛒 Моя корзина' },
        session: { cart: [] },
        reply: jest.fn(),
      } as any;

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('🛒 Ваша корзина пуста.');
    });

    it('should calculate total correctly', async () => {
      const mockCtx = {
        message: { text: '🛒 Моя корзина' },
        session: {
          cart: [
            { productId: 'uuid-1', quantity: 2 },
            { productId: 'uuid-2', quantity: 3 },
          ],
        },
        reply: jest.fn(),
      } as any;

      mockPrismaService.product.findUnique
        .mockResolvedValueOnce({
          id: 'uuid-1',
          name: 'Помидоры',
          price: 3.5,
        })
        .mockResolvedValueOnce({
          id: 'uuid-2',
          name: 'Огурцы',
          price: 2.0,
        });

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('13.00 BYN'),
        expect.any(Object),
      );
    });
  });

  describe('showOrders', () => {
    it('should show no orders message', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '📋 Мои заказы' },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        orders: [],
      });

      await clientBotUpdate.onText(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith('У вас пока нет заказов.');
    });

    it('should show orders with correct status emojis', async () => {
      const mockCtx = {
        from: { id: 123456 },
        message: { text: '📋 Мои заказы' },
        reply: jest.fn(),
      } as any;

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        orders: [
          {
            id: 'order-uuid-1',
            status: 'PENDING',
            totalAmount: 10.5,
          },
          {
            id: 'order-uuid-2',
            status: 'ACCEPTED',
            totalAmount: 15.0,
          },
          {
            id: 'order-uuid-3',
            status: 'COMPLETED',
            totalAmount: 20.0,
          },
          {
            id: 'order-uuid-4',
            status: 'CANCELLED',
            totalAmount: 5.0,
          },
        ],
      });

      await clientBotUpdate.onText(mockCtx);

      const callArgs = mockCtx.reply.mock.calls[0][0];
      expect(callArgs).toContain('⏳');
      expect(callArgs).toContain('✅');
      expect(callArgs).toContain('🎉');
      expect(callArgs).toContain('❌');
    });
  });
});
