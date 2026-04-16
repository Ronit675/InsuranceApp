import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

const DEFAULT_CONNECTION_LIMIT = '5';
const DEFAULT_POOL_TIMEOUT_SECONDS = '30';

const buildPrismaUrl = () => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return rawUrl;
  }

  const url = new URL(rawUrl);

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
  }

  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', DEFAULT_POOL_TIMEOUT_SECONDS);
  }

  return url.toString();
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: buildPrismaUrl(),
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
