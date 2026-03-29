type UserWithProfile = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName?: string | null;
  dateOfBirth?: Date | null;
  address?: string | null;
  profilePhoto?: string | null;
  authProvider?: string;
  profile?: {
    serviceZone: string;
    platform?: string;
    city?: string | null;
    avgDailyIncome?: number;
    platformConnectionStatus?: string;
  } | null;
};

export type AuthUserResponse = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  address: string | null;
  profilePhoto: string | null;
  platform: string | null;
  city: string | null;
  serviceZone: string | null;
  avgDailyIncome: number | null;
  platformConnectionStatus: 'not_connected' | 'verified';
  authProvider: string;
  profileStatus: 'auth_only' | 'platform_linked' | 'active';
};

export const buildAuthUser = (user: UserWithProfile): AuthUserResponse => {
  const profileStatus = !user.profile
    ? 'auth_only'
    : user.profile.serviceZone === 'unknown-zone'
      ? 'platform_linked'
      : 'active';

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName ?? null,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    address: user.address ?? null,
    profilePhoto: user.profilePhoto ?? null,
    platform: user.profile?.platform ?? null,
    city: user.profile?.city ?? null,
    serviceZone: user.profile?.serviceZone ?? null,
    avgDailyIncome:
      user.profile?.platformConnectionStatus === 'verified'
        ? user.profile.avgDailyIncome ?? null
        : null,
    platformConnectionStatus:
      user.profile?.platformConnectionStatus === 'verified' ? 'verified' : 'not_connected',
    authProvider: user.authProvider ?? 'phone',
    profileStatus,
  };
};
