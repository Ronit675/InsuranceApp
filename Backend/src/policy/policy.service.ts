import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PolicyService {
  constructor(private prisma: PrismaService) {}

  async getActivePolicy(userId: string) {
    return this.prisma.policy.findFirst({
      where: { userId, status: 'active' },
      include: {
        claims: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }
}