import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import { buildAuthUser } from './auth-user.util';

type OtpSession = {
  otp: string;
  expiresAt: number;
  lastSentAt: number;
  failedAttempts: number;
};

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_INTERVAL_MS = 30 * 1000;
const MAX_FAILED_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);
  private readonly otpStore = new Map<string, OtpSession>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async googleSignIn(idToken: string) {
    const audience = process.env.GOOGLE_WEB_CLIENT_ID;
    if (!audience) {
      throw new UnauthorizedException('Google client ID is not configured');
    }

    // 1. Verify the token with Google
    let payload: any;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const email = payload?.email;
    if (!email) {
      throw new UnauthorizedException('Google account email is required');
    }

    // 2. Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          authProvider: 'google',
        },
        include: { profile: true },
      });
    }

    return this.createSessionResponse(user);
  }

  async sendPhoneOtp(rawPhone: string) {
    const phone = this.normalizePhoneNumber(rawPhone);
    const existingSession = this.otpStore.get(phone);
    const now = Date.now();

    if (existingSession && now - existingSession.lastSentAt < OTP_RESEND_INTERVAL_MS) {
      throw new HttpException(
        'Please wait before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    this.otpStore.set(phone, {
      otp,
      expiresAt: now + OTP_TTL_MS,
      lastSentAt: now,
      failedAttempts: 0,
    });

    return {
      success: true,
      phone,
      expiresInSeconds: OTP_TTL_MS / 1000,
      debugOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
      delivery: process.env.NODE_ENV === 'production' ? 'pending_sms_setup' : 'debug',
    };
  }

  async verifyPhoneOtp(rawPhone: string, rawOtp: string) {
    const phone = this.normalizePhoneNumber(rawPhone);
    const otp = rawOtp.trim();
    const session = this.otpStore.get(phone);

    if (!session) {
      throw new UnauthorizedException('Request an OTP before verifying');
    }

    if (Date.now() > session.expiresAt) {
      this.otpStore.delete(phone);
      throw new UnauthorizedException('OTP expired. Please request a new one');
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new BadRequestException('OTP must be a 6-digit code');
    }

    if (session.otp !== otp) {
      session.failedAttempts += 1;
      if (session.failedAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
        this.otpStore.delete(phone);
      } else {
        this.otpStore.set(phone, session);
      }
      throw new UnauthorizedException('Invalid OTP');
    }

    this.otpStore.delete(phone);

    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: { profile: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          authProvider: 'phone',
        },
        include: { profile: true },
      });
    }

    return this.createSessionResponse(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException();
    return buildAuthUser(user);
  }

  private createSessionResponse(user: {
    id: string;
    email: string | null;
    phone: string | null;
    profile: { serviceZone: string } | null;
  }) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      phone: user.phone,
    });

    return {
      accessToken,
      user: buildAuthUser(user),
    };
  }

  private normalizePhoneNumber(rawPhone: string) {
    const trimmed = rawPhone.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');

    if (!digitsOnly) {
      throw new BadRequestException('Phone number is required');
    }

    if (trimmed.startsWith('+')) {
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        throw new BadRequestException('Enter a valid phone number');
      }
      return `+${digitsOnly}`;
    }

    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }

    if (digitsOnly.length >= 11 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }

    throw new BadRequestException('Enter a valid phone number');
  }

  private generateOtp() {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH;
    return String(Math.floor(Math.random() * (max - min)) + min);
  }
}

export default AuthService;
