import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PolicyModule } from '../policy/policy.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './mock-platform.service';

@Module({
  imports: [PrismaModule, AuthModule, PolicyModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
