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
import { getRequiredEnv } from '../config/env';

type OtpSession = {
  otp: string;
  expiresAt: number;
  lastSentAt: number;
  failedAttempts: number;
};

type AppStateHistoryEntry = {
  reason: string;
  detectedAt: number;
};

type AppStateResponse = {
  flagCount: number;
  history: AppStateHistoryEntry[];
  currentFlagLevel: 'none' | 'yellow' | 'red' | 'green';
  currentReasons: string[];
  currentStatusText: string;
  lastCheckedAt: number | null;
  redFlagDetectedAt: number | null;
  normalizedAfterRedAt: number | null;
  outOfStationActive: boolean;
  outOfStationSince: number | null;
  outOfStationUntil: number | null;
  outOfStationReturnLabel: string | null;
  appBackToNormalAt: number | null;
};

type SyncAppStateInput = {
  flagCount?: number;
  history?: Array<{ reason?: unknown; detectedAt?: unknown }>;
  currentFlagLevel?: unknown;
  currentReasons?: unknown;
  currentStatusText?: unknown;
  lastCheckedAt?: unknown;
  redFlagDetectedAt?: unknown;
  normalizedAfterRedAt?: unknown;
  outOfStationActive?: unknown;
  outOfStationSince?: unknown;
  outOfStationUntil?: unknown;
  outOfStationReturnLabel?: unknown;
  appBackToNormalAt?: unknown;
};

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_INTERVAL_MS = 30 * 1000;
const MAX_FAILED_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<string, OtpSession>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async googleSignIn(idToken: string) {
    const audience = getRequiredEnv('GOOGLE_WEB_CLIENT_ID');
    const googleClient = new OAuth2Client(audience);

    // 1. Verify the token with Google
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
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

  async getAppState(userId: string): Promise<AppStateResponse> {
    const appState = await this.prisma.riderAppState.upsert({
      where: { userId },
      create: {
        userId,
        currentStatusText: 'GPS check inactive',
      },
      update: {},
      include: {
        flagEvents: {
          orderBy: { detectedAt: 'asc' },
        },
      },
    });

    return this.serializeAppState(appState);
  }

  async updateAppState(userId: string, input: SyncAppStateInput): Promise<AppStateResponse> {
    const normalizedHistory = this.normalizeHistory(input.history);

    const appState = await this.prisma.riderAppState.upsert({
      where: { userId },
      create: {
        userId,
        flagCount: this.normalizeFlagCount(input.flagCount),
        currentFlagLevel: this.normalizeFlagLevel(input.currentFlagLevel),
        currentReasons: this.normalizeReasonList(input.currentReasons),
        currentStatusText: this.normalizeOptionalText(input.currentStatusText) ?? 'GPS check inactive',
        lastCheckedAt: this.parseOptionalDate(input.lastCheckedAt),
        redFlagDetectedAt: this.parseOptionalDate(input.redFlagDetectedAt),
        normalizedAfterRedAt: this.parseOptionalDate(input.normalizedAfterRedAt),
        outOfStationActive: Boolean(input.outOfStationActive),
        outOfStationSince: this.parseOptionalDate(input.outOfStationSince),
        outOfStationUntil: this.parseOptionalDate(input.outOfStationUntil),
        outOfStationReturnLabel: this.normalizeOptionalText(input.outOfStationReturnLabel),
        appBackToNormalAt: this.parseOptionalDate(input.appBackToNormalAt),
      },
      update: {
        flagCount: this.normalizeFlagCount(input.flagCount),
        currentFlagLevel: this.normalizeFlagLevel(input.currentFlagLevel),
        currentReasons: this.normalizeReasonList(input.currentReasons),
        currentStatusText: this.normalizeOptionalText(input.currentStatusText) ?? 'GPS check inactive',
        lastCheckedAt: this.parseOptionalDate(input.lastCheckedAt),
        redFlagDetectedAt: this.parseOptionalDate(input.redFlagDetectedAt),
        normalizedAfterRedAt: this.parseOptionalDate(input.normalizedAfterRedAt),
        outOfStationActive: Boolean(input.outOfStationActive),
        outOfStationSince: this.parseOptionalDate(input.outOfStationSince),
        outOfStationUntil: this.parseOptionalDate(input.outOfStationUntil),
        outOfStationReturnLabel: this.normalizeOptionalText(input.outOfStationReturnLabel),
        appBackToNormalAt: this.parseOptionalDate(input.appBackToNormalAt),
      },
      select: { id: true },
    });

    if (normalizedHistory.length > 0) {
      await this.prisma.flagEvent.createMany({
        data: normalizedHistory.map((entry) => ({
          appStateId: appState.id,
          reason: entry.reason,
          detectedAt: new Date(entry.detectedAt),
        })),
        skipDuplicates: true,
      });
    }

    return this.getAppState(userId);
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

  private serializeAppState(appState: {
    flagCount: number;
    currentFlagLevel: string;
    currentReasons: string[];
    currentStatusText: string;
    lastCheckedAt: Date | null;
    redFlagDetectedAt: Date | null;
    normalizedAfterRedAt: Date | null;
    outOfStationActive: boolean;
    outOfStationSince: Date | null;
    outOfStationUntil: Date | null;
    outOfStationReturnLabel: string | null;
    appBackToNormalAt: Date | null;
    flagEvents: Array<{ reason: string; detectedAt: Date }>;
  }): AppStateResponse {
    return {
      flagCount: appState.flagCount,
      history: appState.flagEvents.map((entry) => ({
        reason: entry.reason,
        detectedAt: entry.detectedAt.getTime(),
      })),
      currentFlagLevel: this.normalizeFlagLevel(appState.currentFlagLevel),
      currentReasons: appState.currentReasons,
      currentStatusText: appState.currentStatusText,
      lastCheckedAt: appState.lastCheckedAt?.getTime() ?? null,
      redFlagDetectedAt: appState.redFlagDetectedAt?.getTime() ?? null,
      normalizedAfterRedAt: appState.normalizedAfterRedAt?.getTime() ?? null,
      outOfStationActive: appState.outOfStationActive,
      outOfStationSince: appState.outOfStationSince?.getTime() ?? null,
      outOfStationUntil: appState.outOfStationUntil?.getTime() ?? null,
      outOfStationReturnLabel: appState.outOfStationReturnLabel,
      appBackToNormalAt: appState.appBackToNormalAt?.getTime() ?? null,
    };
  }

  private normalizeFlagCount(value: unknown) {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return 0;
    }

    return Math.max(0, Math.floor(parsedValue));
  }

  private normalizeFlagLevel(value: unknown): AppStateResponse['currentFlagLevel'] {
    switch (value) {
      case 'yellow':
      case 'red':
      case 'green':
        return value;
      default:
        return 'none';
    }
  }

  private normalizeReasonList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(new Set(
      value
        .map((entry) => this.normalizeOptionalText(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ));
  }

  private normalizeHistory(value: SyncAppStateInput['history']): AppStateHistoryEntry[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const dedupedEntries = new Map<string, AppStateHistoryEntry>();

    value.forEach((entry) => {
      const reason = this.normalizeOptionalText(entry?.reason);
      const detectedAt = this.parseOptionalDate(entry?.detectedAt)?.getTime();

      if (!reason || !detectedAt) {
        return;
      }

      dedupedEntries.set(`${reason}:${detectedAt}`, { reason, detectedAt });
    });

    return Array.from(dedupedEntries.values()).sort((left, right) => left.detectedAt - right.detectedAt);
  }

  private normalizeOptionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : null;
  }

  private parseOptionalDate(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    let nextDate: Date;
    if (typeof value === 'number') {
      nextDate = new Date(value);
    } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      nextDate = new Date(Number(value.trim()));
    } else if (typeof value === 'string') {
      nextDate = new Date(value);
    } else {
      throw new BadRequestException('Invalid timestamp value');
    }

    if (Number.isNaN(nextDate.getTime())) {
      throw new BadRequestException('Invalid timestamp value');
    }

    return nextDate;
  }
}

export default AuthService;
