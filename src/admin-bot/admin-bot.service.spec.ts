import { Test, TestingModule } from '@nestjs/testing';
import { AdminBotService } from './admin-bot.service';
import { PrismaService } from '../prisma/prisma.service';
import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
import { getBotToken } from 'nestjs-telegraf';

describe('AdminBotService', () => {
  let service: AdminBotService;
  let prismaService: PrismaService;
  let adminBot: Telegraf<BotContext>;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const mockAdminBot = {
    telegram: {
      sendMessage: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBotService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getBotToken('admin'),
          useValue: mockAdminBot,
        },
      ],
    }).compile();

    service = module.get<AdminBotService>(AdminBotService);
    prismaService = module.get<PrismaService>(PrismaService);
    adminBot = module.get<Telegraf<BotContext>>(getBotToken('admin'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyNewOrder', () => {
    it('should notify all admins about new order', async () => {
      const orderId = 'order-uuid-1';

      mockPrismaService.user.findMany.mockResolvedValue([
        { telegramId: '111' },
        { telegramId: '222' },
      ]);

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        user: {
          username: 'testuser',
          phone: '+375291234567',
        },
        address: 'Минск, ул. Ленина 1',
        totalAmount: 15.5,
        orderItems: [
          {
            product: { name: 'Помидоры' },
            quantity: 2,
            price: 5.0,
          },
          {
            product: { name: 'Огурцы' },
            quantity: 3,
            price: 3.5,
          },
        ],
      });

      await service.notifyNewOrder(orderId);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: 'ADMIN' },
      });

      expect(mockAdminBot.telegram.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockAdminBot.telegram.sendMessage).toHaveBeenCalledWith(
        '111',
        expect.stringContaining('🔔 Новый заказ'),
        expect.any(Object),
      );
      expect(mockAdminBot.telegram.sendMessage).toHaveBeenCalledWith(
        '222',
        expect.stringContaining('🔔 Новый заказ'),
        expect.any(Object),
      );
    });

    it('should handle order not found', async () => {
      const orderId = 'order-uuid-1';

      mockPrismaService.user.findMany.mockResolvedValue([
        { telegramId: '111' },
      ]);

      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await service.notifyNewOrder(orderId);

      expect(mockAdminBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle no admins found', async () => {
      const orderId = 'order-uuid-1';

      mockPrismaService.user.findMany.mockResolvedValue([]);

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        user: { username: 'testuser' },
        address: 'Минск',
        totalAmount: 10,
        orderItems: [],
      });

      await service.notifyNewOrder(orderId);

      expect(mockAdminBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should include order details in notification', async () => {
      const orderId = 'order-uuid-1';

      mockPrismaService.user.findMany.mockResolvedValue([
        { telegramId: '111' },
      ]);

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        user: {
          username: 'testuser',
          phone: '+375291234567',
        },
        address: 'Минск, ул. Ленина 1',
        totalAmount: 15.5,
        orderItems: [
          {
            product: { name: 'Помидоры' },
            quantity: 2,
            price: 5.0,
          },
        ],
      });

      await service.notifyNewOrder(orderId);

      const callArgs = mockAdminBot.telegram.sendMessage.mock.calls[0];
      const message = callArgs[1];

      expect(message).toContain('testuser');
      expect(message).toContain('+375291234567');
      expect(message).toContain('Минск, ул. Ленина 1');
      expect(message).toContain('Помидоры');
      expect(message).toContain('15.5 BYN');
    });

    it('should include inline keyboard with accept/cancel buttons', async () => {
      const orderId = 'order-uuid-1';

      mockPrismaService.user.findMany.mockResolvedValue([
        { telegramId: '111' },
      ]);

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        user: { username: 'testuser' },
        address: 'Минск',
        totalAmount: 10,
        orderItems: [],
      });

      await service.notifyNewOrder(orderId);

      const callArgs = mockAdminBot.telegram.sendMessage.mock.calls[0];
      const options = callArgs[2];

      expect(options).toHaveProperty('reply_markup');
      expect(options.reply_markup).toHaveProperty('inline_keyboard');
      expect(options.reply_markup.inline_keyboard[0]).toHaveLength(2);
    });

    it('should handle send message error gracefully', async () => {
      const orderId = 'order-uuid-1';

      mockPrismaService.user.findMany.mockResolvedValue([
        { telegramId: '111' },
      ]);

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        user: { username: 'testuser' },
        address: 'Минск',
        totalAmount: 10,
        orderItems: [],
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAdminBot.telegram.sendMessage.mockRejectedValue(new Error('Send error'));

      // Should not throw
      await expect(service.notifyNewOrder(orderId)).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to notify admin 111:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
