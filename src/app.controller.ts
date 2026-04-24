import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getStatus() {
    const now = new Date();
    let dbStatus = 'disconnected';
    let dbLatency = 0;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - start;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
    }

    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

    let products = [];
    try {
      products = await this.prisma.product.findMany({
        where: { stock: { gt: 0 } },
        select: {
          name: true,
          stock: true,
          price: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      products = [];
    }

    return {
      status: 'alive',
      service: 'Veggie Bot',
      timestamp: now.toISOString(),
      uptime: uptimeFormatted,
      database: {
        status: dbStatus,
        latency: `${dbLatency}ms`,
      },
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      products: products.map(p => `${p.name} - ${p.stock} шт. (${p.price}₽)`),
    };
  }

  @Get('health')
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (error) {
      return { status: 'error', database: 'disconnected', error: error.message };
    }
  }
}
