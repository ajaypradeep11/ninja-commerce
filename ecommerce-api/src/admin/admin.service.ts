import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminStatsDto } from './dto/admin-stats.dto';

export const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminStatsDto> {
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const [ordersToday, lowStockProducts] = await Promise.all([
      this.prisma.order.count({
        where: {
          createdAt: { gte: startOfTodayUtc },
          status: { notIn: ['PENDING', 'CANCELLED'] },
        },
      }),
      this.prisma.product.findMany({
        where: { active: true, stockQty: { lte: LOW_STOCK_THRESHOLD } },
        select: { id: true, name: true, slug: true, stockQty: true },
        orderBy: { stockQty: 'asc' },
      }),
    ]);
    return { ordersToday, lowStockProducts };
  }
}
