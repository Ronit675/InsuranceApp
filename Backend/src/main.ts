import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRequiredEnv } from './config/env';

async function bootstrap() {
  getRequiredEnv('DATABASE_URL');
  getRequiredEnv('JWT_SECRET');

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on http://0.0.0.0:${port}`);
}

bootstrap();
