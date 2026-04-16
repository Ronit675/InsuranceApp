import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../Jwt/jwt.strategy';
import { JwtAuthGuard } from '../Jwt/jwtauth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { getRequiredEnv } from '../config/env';

const jwtSecret = getRequiredEnv('JWT_SECRET');

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  // Export JwtAuthGuard so other modules (policy, claims) can import it directly
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
