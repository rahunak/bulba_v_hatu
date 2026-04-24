import { Test, TestingModule } from '@nestjs/testing';
import { BotLauncherService } from './bot-launcher.service';
import { Telegraf } from 'telegraf';
import { BotContext } from '../interfaces/bot-context.interface';
import { getBotToken } from 'nestjs-telegraf';

describe('BotLauncherService', () => {
  let service: BotLauncherService;
  let clientBot: Telegraf<BotContext>;
  let adminBot: Telegraf<BotContext>;

  const mockClientBot = {
    launch: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  };

  const mockAdminBot = {
    launch: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotLauncherService,
        {
          provide: getBotToken('client'),
          useValue: mockClientBot,
        },
        {
          provide: getBotToken('admin'),
          useValue: mockAdminBot,
        },
      ],
    }).compile();

    service = module.get<BotLauncherService>(BotLauncherService);
    clientBot = module.get<Telegraf<BotContext>>(getBotToken('client'));
    adminBot = module.get<Telegraf<BotContext>>(getBotToken('admin'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should launch both bots in polling mode', async () => {
      await service.onModuleInit();

      expect(mockClientBot.launch).toHaveBeenCalledWith({
        dropPendingUpdates: true,
      });
      expect(mockAdminBot.launch).toHaveBeenCalledWith({
        dropPendingUpdates: true,
      });
    });

    it('should handle client bot launch error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClientBot.launch.mockRejectedValueOnce(new Error('Client bot error'));

      await service.onModuleInit();

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to start client bot:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle admin bot launch error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAdminBot.launch.mockRejectedValueOnce(new Error('Admin bot error'));

      await service.onModuleInit();

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to start admin bot:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log success messages when bots start', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.onModuleInit();

      // Wait for promises to resolve
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleLogSpy).toHaveBeenCalledWith('Starting bots in polling mode...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Client bot started successfully');
      expect(consoleLogSpy).toHaveBeenCalledWith('Admin bot started successfully');

      consoleLogSpy.mockRestore();
    });

    it('should setup SIGINT handler', async () => {
      const processOnceSpy = jest.spyOn(process, 'once');

      await service.onModuleInit();

      expect(processOnceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Trigger SIGINT handler
      const sigintHandler = processOnceSpy.mock.calls.find(call => call[0] === 'SIGINT')?.[1];
      if (sigintHandler && typeof sigintHandler === 'function') {
        sigintHandler();
        expect(mockClientBot.stop).toHaveBeenCalledWith('SIGINT');
        expect(mockAdminBot.stop).toHaveBeenCalledWith('SIGINT');
      }

      processOnceSpy.mockRestore();
    });

    it('should setup SIGTERM handler', async () => {
      const processOnceSpy = jest.spyOn(process, 'once');

      await service.onModuleInit();

      expect(processOnceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      // Trigger SIGTERM handler
      const sigtermHandler = processOnceSpy.mock.calls.find(call => call[0] === 'SIGTERM')?.[1];
      if (sigtermHandler && typeof sigtermHandler === 'function') {
        sigtermHandler();
        expect(mockClientBot.stop).toHaveBeenCalledWith('SIGTERM');
        expect(mockAdminBot.stop).toHaveBeenCalledWith('SIGTERM');
      }

      processOnceSpy.mockRestore();
    });
  });
});
