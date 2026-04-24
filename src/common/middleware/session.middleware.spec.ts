import { Test, TestingModule } from '@nestjs/testing';
import { SessionMiddleware } from './session.middleware';
import { PrismaService } from '../../prisma/prisma.service';
import { BotContext } from '../interfaces/bot-context.interface';

describe('SessionMiddleware', () => {
  let sessionMiddleware: SessionMiddleware;
  let prismaService: PrismaService;

  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionMiddleware,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    sessionMiddleware = module.get<SessionMiddleware>(SessionMiddleware);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('middleware', () => {
    it('should create session if not exists', async () => {
      const mockCtx = {
        from: { id: 123456 },
        session: undefined,
      } as any;

      const mockNext = jest.fn();

      mockPrismaService.session.findUnique.mockResolvedValue(null);
      mockPrismaService.session.create.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        sessionData: {},
        updatedAt: new Date(),
      });

      const middleware = sessionMiddleware.middleware();
      await middleware(mockCtx, mockNext);

      expect(mockPrismaService.session.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
      });
      expect(mockPrismaService.session.create).toHaveBeenCalledWith({
        data: { telegramId: '123456', sessionData: {} },
      });
      expect(mockCtx.session).toEqual({});
      expect(mockNext).toHaveBeenCalled();
    });

    it('should load existing session', async () => {
      const mockCtx = {
        from: { id: 123456 },
        session: undefined,
      } as any;

      const mockNext = jest.fn();

      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        sessionData: { cart: [{ productId: 'uuid-1', quantity: 2 }] },
        updatedAt: new Date(),
      });

      const middleware = sessionMiddleware.middleware();
      await middleware(mockCtx, mockNext);

      expect(mockPrismaService.session.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
      });
      expect(mockCtx.session).toEqual({ cart: [{ productId: 'uuid-1', quantity: 2 }] });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle race condition with P2002 error', async () => {
      const mockCtx = {
        from: { id: 123456 },
        session: undefined,
      } as any;

      const mockNext = jest.fn();

      mockPrismaService.session.findUnique.mockResolvedValueOnce(null);

      const p2002Error = new Error('Unique constraint failed');
      (p2002Error as any).code = 'P2002';
      mockPrismaService.session.create.mockRejectedValueOnce(p2002Error);

      mockPrismaService.session.findUnique.mockResolvedValueOnce({
        id: 'uuid-1',
        telegramId: '123456',
        sessionData: {},
        updatedAt: new Date(),
      });

      const middleware = sessionMiddleware.middleware();
      await middleware(mockCtx, mockNext);

      expect(mockPrismaService.session.findUnique).toHaveBeenCalledTimes(2);
      expect(mockCtx.session).toEqual({});
      expect(mockNext).toHaveBeenCalled();
    });

    it('should save session on next call', async () => {
      const mockCtx = {
        from: { id: 123456 },
        session: undefined,
      } as any;

      const mockNext = jest.fn().mockImplementation(async () => {
        // Simulate handler modifying session
        mockCtx.session.cart = [{ productId: 'uuid-1', quantity: 3 }];
      });

      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        sessionData: {},
        updatedAt: new Date(),
      });

      mockPrismaService.session.update.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        sessionData: { cart: [{ productId: 'uuid-1', quantity: 3 }] },
        updatedAt: new Date(),
      });

      const middleware = sessionMiddleware.middleware();
      await middleware(mockCtx, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Session should be updated after next() completes
      expect(mockPrismaService.session.update).toHaveBeenCalledWith({
        where: { telegramId: '123456' },
        data: {
          sessionData: { cart: [{ productId: 'uuid-1', quantity: 3 }] },
        },
      });
    });

    it('should skip if no telegramId', async () => {
      const mockCtx = {
        from: undefined,
        session: undefined,
      } as any;

      const mockNext = jest.fn();

      const middleware = sessionMiddleware.middleware();
      await middleware(mockCtx, mockNext);

      expect(mockPrismaService.session.findUnique).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle session update errors gracefully', async () => {
      const mockCtx = {
        from: { id: 123456 },
        session: undefined,
      } as any;

      const mockNext = jest.fn();

      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'uuid-1',
        telegramId: '123456',
        sessionData: {},
        updatedAt: new Date(),
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPrismaService.session.update.mockRejectedValue(new Error('Database error'));

      const middleware = sessionMiddleware.middleware();

      // Should not throw even if update fails
      await expect(middleware(mockCtx, mockNext)).rejects.toThrow('Database error');

      expect(mockNext).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
