import { Test, TestingModule } from '@nestjs/testing';
import { ClientBotService } from './client-bot.service';
import { Telegraf } from 'telegraf';
import { BotContext } from '../common/interfaces/bot-context.interface';
import { getBotToken } from 'nestjs-telegraf';

describe('ClientBotService', () => {
  let service: ClientBotService;
  let clientBot: Telegraf<BotContext>;

  const mockClientBot = {
    telegram: {
      sendMessage: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientBotService,
        {
          provide: getBotToken('client'),
          useValue: mockClientBot,
        },
      ],
    }).compile();

    service = module.get<ClientBotService>(ClientBotService);
    clientBot = module.get<Telegraf<BotContext>>(getBotToken('client'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOrderConfirmation', () => {
    it('should send order confirmation message', async () => {
      const chatId = 123456;
      const orderId = 'order-uuid-1';

      mockClientBot.telegram.sendMessage.mockResolvedValue({});

      await service.sendOrderConfirmation(chatId, orderId);

      expect(mockClientBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('✅ Ваш заказ #order-uuid-1 принят!'),
        undefined,
      );
    });

    it('should handle send message error', async () => {
      const chatId = 123456;
      const orderId = 'order-uuid-1';

      mockClientBot.telegram.sendMessage.mockRejectedValue(new Error('Send error'));

      await expect(service.sendOrderConfirmation(chatId, orderId)).rejects.toThrow('Send error');
    });
  });

  describe('sendOrderStatusUpdate', () => {
    beforeEach(() => {
      mockClientBot.telegram.sendMessage.mockReset();
      mockClientBot.telegram.sendMessage.mockResolvedValue({});
    });

    it('should send ACCEPTED status update', async () => {
      const chatId = 123456;
      const orderId = 'order-uuid-1';

      await service.sendOrderStatusUpdate(chatId, orderId, 'ACCEPTED');

      expect(mockClientBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Заказ #order-uuid-1: ✅ Ваш заказ принят в обработку',
        undefined,
      );
    });

    it('should send CANCELLED status update', async () => {
      const chatId = 123456;
      const orderId = 'order-uuid-1';

      await service.sendOrderStatusUpdate(chatId, orderId, 'CANCELLED');

      expect(mockClientBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Заказ #order-uuid-1: ❌ Ваш заказ отменен',
        undefined,
      );
    });

    it('should send COMPLETED status update', async () => {
      const chatId = 123456;
      const orderId = 'order-uuid-1';

      await service.sendOrderStatusUpdate(chatId, orderId, 'COMPLETED');

      expect(mockClientBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Заказ #order-uuid-1: 🎉 Ваш заказ выполнен',
        undefined,
      );
    });

    it('should send default message for unknown status', async () => {
      const chatId = 123456;
      const orderId = 'order-uuid-1';

      await service.sendOrderStatusUpdate(chatId, orderId, 'UNKNOWN');

      expect(mockClientBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Заказ #order-uuid-1: Статус заказа изменен',
        undefined,
      );
    });
  });

  describe('sendMessage', () => {
    it('should send message with extra options', async () => {
      const chatId = 123456;
      const text = 'Test message';
      const extra = { parse_mode: 'Markdown' };

      mockClientBot.telegram.sendMessage.mockResolvedValue({});

      await service.sendMessage(chatId, text, extra);

      expect(mockClientBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        text,
        extra,
      );
    });
  });
});

