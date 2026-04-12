import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthUser } from './auth.service';
import { fetchCurrentWeatherSnapshot } from './weather';

export type WorkingWindow = {
  label: string;
  key: string;
  start: Date;
  end: Date;
};

export type StoredRainDisruptionTimer = {
  claimSessionKey?: string;
  creditedHours?: number;
  startedAtMs: number;
  windowKey: string;
};

export type RainDisruptionTrackingState = {
  isWithinWorkingWindow: boolean;
  isTracking: boolean;
  rainfallRateMmPerHr: number | null;
  weatherSummary: string;
  trackedStartMs: number | null;
  trackedClaimSessionKey: string | null;
  trackedWindowKey: string | null;
};

const RAIN_DISRUPTION_STORAGE_KEY_PREFIX = 'rain-disruption:';

export const RAIN_TRIGGER_THRESHOLD_MM_PER_HR = 8;

export const getRainDisruptionStorageKey = (userId: string | null | undefined) =>
  `${RAIN_DISRUPTION_STORAGE_KEY_PREFIX}${userId ?? 'anonymous'}`;

export const buildClaimSessionKey = (windowKey: string, startedAtMs: number) =>
  `${windowKey}:${startedAtMs}`;

const parseTimeToken = (value: string, baseDate: Date) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const [, hoursToken, minutesToken, periodToken] = match;
  const hours = Number(hoursToken) % 12;
  const minutes = Number(minutesToken);
  const period = periodToken.toUpperCase();

  const parsedDate = new Date(baseDate);
  parsedDate.setHours(period === 'PM' ? hours + 12 : hours, minutes, 0, 0);
  return parsedDate;
};

const parseWorkingWindow = (label: string, now: Date): WorkingWindow | null => {
  const [startLabel, endLabel] = label.split(' - ');
  if (!startLabel || !endLabel) {
    return null;
  }

  const start = parseTimeToken(startLabel, now);
  const end = parseTimeToken(endLabel, now);
  if (!start || !end) {
    return null;
  }

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return {
    label,
    key: `${label}:${start.toISOString()}`,
    start,
    end,
  };
};

export const getActiveWorkingWindow = (user: AuthUser | null, now: Date): WorkingWindow | null => {
  const assignedShift = user?.workingShiftLabel?.trim();
  if (assignedShift) {
    const parsedShift = parseWorkingWindow(assignedShift, now);
    if (parsedShift && now >= parsedShift.start && now < parsedShift.end) {
      return parsedShift;
    }
  }

  for (const timeSlot of user?.workingTimeSlots ?? []) {
    const parsedSlot = parseWorkingWindow(timeSlot, now);
    if (parsedSlot && now >= parsedSlot.start && now < parsedSlot.end) {
      return parsedSlot;
    }
  }

  return null;
};

export const readStoredRainDisruptionTimer = async (
  storageKey: string,
): Promise<StoredRainDisruptionTimer | null> => {
  const rawValue = await AsyncStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredRainDisruptionTimer;
  } catch {
    await AsyncStorage.removeItem(storageKey);
    return null;
  }
};

export const persistStoredRainDisruptionTimer = async (
  storageKey: string,
  timer: StoredRainDisruptionTimer,
) => {
  await AsyncStorage.setItem(storageKey, JSON.stringify(timer));
};

export const clearStoredRainDisruptionTimer = async (storageKey: string) => {
  await AsyncStorage.removeItem(storageKey);
};

export const getRainDisruptionTrackingState = async (
  user: AuthUser | null,
): Promise<RainDisruptionTrackingState> => {
  const now = new Date();
  const storageKey = getRainDisruptionStorageKey(user?.id);
  const activeWorkingWindow = getActiveWorkingWindow(user, now);

  if (!activeWorkingWindow) {
    await clearStoredRainDisruptionTimer(storageKey);
    return {
      isWithinWorkingWindow: false,
      isTracking: false,
      rainfallRateMmPerHr: null,
      weatherSummary: 'Outside the rider working slot',
      trackedStartMs: null,
      trackedClaimSessionKey: null,
      trackedWindowKey: null,
    };
  }

  const weatherSnapshot = await fetchCurrentWeatherSnapshot();
  const currentRainfallRate = weatherSnapshot.rainfallRateMmPerHr;

  if (currentRainfallRate <= RAIN_TRIGGER_THRESHOLD_MM_PER_HR) {
    await clearStoredRainDisruptionTimer(storageKey);
    return {
      isWithinWorkingWindow: true,
      isTracking: false,
      rainfallRateMmPerHr: currentRainfallRate,
      weatherSummary: `Current rain rate ${currentRainfallRate.toFixed(1)} mm/hr`,
      trackedStartMs: null,
      trackedClaimSessionKey: null,
      trackedWindowKey: null,
    };
  }

  const storedTimer = await readStoredRainDisruptionTimer(storageKey);
  const fallbackStartMs = Math.max(
    activeWorkingWindow.start.getTime(),
    now.getTime(),
  );
  const startedAtMs = storedTimer?.windowKey === activeWorkingWindow.key
    ? storedTimer.startedAtMs
    : fallbackStartMs;
  const claimSessionKey = storedTimer?.windowKey === activeWorkingWindow.key
    ? storedTimer.claimSessionKey ?? buildClaimSessionKey(activeWorkingWindow.key, startedAtMs)
    : buildClaimSessionKey(activeWorkingWindow.key, startedAtMs);
  const creditedHours = storedTimer?.windowKey === activeWorkingWindow.key
    ? storedTimer.creditedHours ?? 0
    : 0;

  if (
    storedTimer?.windowKey !== activeWorkingWindow.key
    || storedTimer.startedAtMs !== startedAtMs
    || storedTimer.claimSessionKey !== claimSessionKey
    || storedTimer.creditedHours !== creditedHours
  ) {
    await persistStoredRainDisruptionTimer(storageKey, {
      claimSessionKey,
      creditedHours,
      startedAtMs,
      windowKey: activeWorkingWindow.key,
    });
  }

  return {
    isWithinWorkingWindow: true,
    isTracking: true,
    rainfallRateMmPerHr: currentRainfallRate,
    weatherSummary: `Current rain rate ${currentRainfallRate.toFixed(1)} mm/hr`,
    trackedStartMs: startedAtMs,
    trackedClaimSessionKey: claimSessionKey,
    trackedWindowKey: activeWorkingWindow.key,
  };
};
