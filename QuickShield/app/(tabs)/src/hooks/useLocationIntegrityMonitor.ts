import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

export type LocationIntegrityReason =
  | 'mock_location_detected'
  | 'teleportation'
  | 'unnatural_velocity_curve'
  | 'outside_working_area'
  | 'permission_denied'
  | 'gps_unavailable'
  | 'location_error';

type LocationSample = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export type FlagHistoryEntry = {
  reason: LocationIntegrityReason;
  detectedAt: number;
};

type UseLocationIntegrityMonitorOptions = {
  enabled: boolean;
  pollIntervalMs?: number;
  hydratedState?: Partial<LocationIntegrityState> | null;
};

export type LocationIntegrityFlagLevel = 'none' | 'yellow' | 'red' | 'green';

export type LocationIntegrityState = {
  isFlagged: boolean;
  flagLevel: LocationIntegrityFlagLevel;
  isChecking: boolean;
  reasons: LocationIntegrityReason[];
  statusText: string;
  lastCheckedAt: number | null;
  redFlagCount: number;
  history: FlagHistoryEntry[];
  redFlagDetectedAt: number | null;
  normalizedAfterRedAt: number | null;
  consecutiveInnerRadiusPoints: number;
};

const EARTH_RADIUS_KM = 6371;
export const WORKING_AREA_RADIUS_KM = 25;
const INNER_RADIUS_KM = 10;
const DURATION_CHECK_GPS_POINTS = 5;
const MAX_SAMPLE_HISTORY = 6;
const MAX_SPEED_HISTORY = 8;
const TELEPORT_DISTANCE_KM = 2;
const TELEPORT_WINDOW_SECONDS = 90;
const GREEN_FLAG_RECOVERY_WINDOW_MS = 60 * 1000; // 1 minute of clean GPS after red
export const WORKING_AREA_CENTER = {
  // Whitefield, Bengaluru
  latitude: 12.9698,
  longitude: 77.7499,
};

const REASON_TEXT: Record<LocationIntegrityReason, string> = {
  mock_location_detected: 'Mock location provider detected',
  teleportation: 'Detected 2 km+ jump in under 90 seconds',
  unnatural_velocity_curve: 'Velocity curve looks unnatural',
  outside_working_area: 'Outside 25 km working area',
  permission_denied: 'Location permission denied',
  gps_unavailable: 'GPS services are disabled',
  location_error: 'Unable to read current location',
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const latDistance = toRadians(b.latitude - a.latitude);
  const lonDistance = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(latDistance / 2);
  const sinLon = Math.sin(lonDistance / 2);

  const root = sinLat * sinLat
    + Math.cos(toRadians(a.latitude))
    * Math.cos(toRadians(b.latitude))
    * sinLon * sinLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(root));
};

const hasUnnaturalVelocityCurve = (speedsKmh: number[]) => {
  if (speedsKmh.length < 4) {
    return false;
  }

  const windowSpeeds = speedsKmh.slice(-4);
  const deltas = windowSpeeds.slice(1).map((speed, index) => speed - windowSpeeds[index]);
  const maxDelta = Math.max(...deltas.map((delta) => Math.abs(delta)));
  const averageDelta = deltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / deltas.length;
  const velocityRange = Math.max(...windowSpeeds) - Math.min(...windowSpeeds);

  let signFlips = 0;
  for (let index = 1; index < deltas.length; index += 1) {
    if (deltas[index] * deltas[index - 1] < 0) {
      signFlips += 1;
    }
  }

  return signFlips >= 2
    && maxDelta >= 45
    && averageDelta >= 30
    && velocityRange >= 70;
};

const normalizeTimestamp = (timestamp: number, previousTimestamp: number | null) => {
  if (previousTimestamp === null) {
    return timestamp;
  }

  if (timestamp > previousTimestamp) {
    return timestamp;
  }

  return previousTimestamp + 1_000;
};

export const isWithinWorkingAreaRadius = (latitude: number, longitude: number) => {
  const distanceFromWorkingAreaKm = calculateDistanceKm(
    { latitude, longitude },
    WORKING_AREA_CENTER,
  );

  return distanceFromWorkingAreaKm <= WORKING_AREA_RADIUS_KM;
};

const isWithinInnerRadius = (latitude: number, longitude: number) => {
  const distanceFromWorkingAreaKm = calculateDistanceKm(
    { latitude, longitude },
    WORKING_AREA_CENTER,
  );

  return distanceFromWorkingAreaKm <= INNER_RADIUS_KM;
};

const isMockedLocation = (location: Location.LocationObject) => {
  const coordsWithMocked = location.coords as Location.LocationObjectCoords & { mocked?: boolean };
  const locationWithMocked = location as Location.LocationObject & { mocked?: boolean };
  return Boolean(coordsWithMocked?.mocked ?? locationWithMocked?.mocked);
};

const isRedSeverityReason = (reason: LocationIntegrityReason) =>
  reason === 'mock_location_detected'
  || reason === 'teleportation'
  || reason === 'unnatural_velocity_curve';

export const useLocationIntegrityMonitor = ({
  enabled,
  pollIntervalMs = 60_000,
  hydratedState = null,
}: UseLocationIntegrityMonitorOptions): LocationIntegrityState => {
  const [state, setState] = useState<LocationIntegrityState>({
    isFlagged: false,
    flagLevel: 'none',
    isChecking: false,
    reasons: [],
    statusText: 'GPS check inactive',
    lastCheckedAt: null,
    redFlagCount: 0,
    history: [],
    redFlagDetectedAt: null,
    normalizedAfterRedAt: null,
    consecutiveInnerRadiusPoints: 0,
  });

  const inFlightRef = useRef(false);
  const locationSamplesRef = useRef<LocationSample[]>([]);
  const speedHistoryRef = useRef<number[]>([]);
  const consecutiveInnerRadiusPointsRef = useRef<number>(0);
  const hasCompletedInitialForegroundCheckRef = useRef(false);
  const hasPromptedForPermissionRef = useRef(false);
  const hasPromptedForGpsRef = useRef(false);
  const hasAppliedHydratedStateRef = useRef(false);

  useEffect(() => {
    if (!hydratedState) {
      hasAppliedHydratedStateRef.current = false;
      return;
    }

    if (hasAppliedHydratedStateRef.current) {
      return;
    }

    setState((current) => ({
      ...current,
      ...hydratedState,
      isFlagged: hydratedState.isFlagged ?? (hydratedState.flagLevel ?? current.flagLevel) !== 'none',
      reasons: hydratedState.reasons ? [...hydratedState.reasons] : current.reasons,
      history: hydratedState.history ? [...hydratedState.history] : current.history,
    }));
    hasAppliedHydratedStateRef.current = true;
  }, [hydratedState]);

  const promptToOpenSettings = (title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]);
  };

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({
        ...current,
        isChecking: false,
        redFlagDetectedAt: null,
        normalizedAfterRedAt: null,
        consecutiveInnerRadiusPoints: 0,
      }));
      consecutiveInnerRadiusPointsRef.current = 0;
      hasCompletedInitialForegroundCheckRef.current = false;
      hasPromptedForPermissionRef.current = false;
      hasPromptedForGpsRef.current = false;
      return;
    }

    hasPromptedForPermissionRef.current = false;
    hasPromptedForGpsRef.current = false;

    let cancelled = false;

    const runIntegrityCheck = async () => {
      if (inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;

      try {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        const permission = existingPermission.granted
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          if (!hasPromptedForPermissionRef.current) {
            hasPromptedForPermissionRef.current = true;
            promptToOpenSettings(
              'Location access required',
              'QuickShield needs location access to verify if a rider is within the 25 km working area.',
            );
          }

          if (!cancelled) {
            setState((current) => ({
              ...current,
              isFlagged: false,
              flagLevel: 'none',
              isChecking: false,
              reasons: [],
              statusText: REASON_TEXT.permission_denied,
              lastCheckedAt: Date.now(),
              redFlagDetectedAt: null,
              normalizedAfterRedAt: null,
              consecutiveInnerRadiusPoints: 0,
              history: current.history,
            }));
          }
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (!hasPromptedForGpsRef.current) {
            hasPromptedForGpsRef.current = true;
            promptToOpenSettings(
              'Turn on location services',
              'GPS is off. Enable location services to verify if the rider is within the 25 km working area.',
            );
          }

          if (!cancelled) {
            setState((current) => ({
              ...current,
              isFlagged: false,
              flagLevel: 'none',
              isChecking: false,
              reasons: [],
              statusText: REASON_TEXT.gps_unavailable,
              lastCheckedAt: Date.now(),
              redFlagDetectedAt: null,
              normalizedAfterRedAt: null,
              consecutiveInnerRadiusPoints: 0,
              history: current.history,
            }));
          }
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        const previousSample = locationSamplesRef.current[locationSamplesRef.current.length - 1] ?? null;
        const normalizedTimestamp = normalizeTimestamp(
          currentLocation.timestamp ?? Date.now(),
          previousSample?.timestamp ?? null,
        );

        const currentSample: LocationSample = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          timestamp: normalizedTimestamp,
        };

        const nextSamples = [...locationSamplesRef.current, currentSample].slice(-MAX_SAMPLE_HISTORY);
        locationSamplesRef.current = nextSamples;

        const isOutsideWorkingArea = !isWithinWorkingAreaRadius(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
        );

        const reasons: LocationIntegrityReason[] = [];
        const isInitialForegroundCheck = !hasCompletedInitialForegroundCheckRef.current;
        if (isInitialForegroundCheck && isOutsideWorkingArea) {
          reasons.push('outside_working_area');
        }

        if (isMockedLocation(currentLocation)) {
          reasons.push('mock_location_detected');
        }

        if (previousSample) {
          const deltaSeconds = (currentSample.timestamp - previousSample.timestamp) / 1000;
          if (deltaSeconds > 0) {
            const distanceKm = calculateDistanceKm(previousSample, currentSample);
            const speedKmh = distanceKm / (deltaSeconds / 3600);
            const nextSpeedHistory = [...speedHistoryRef.current, speedKmh].slice(-MAX_SPEED_HISTORY);
            speedHistoryRef.current = nextSpeedHistory;

            if (distanceKm >= TELEPORT_DISTANCE_KM && deltaSeconds < TELEPORT_WINDOW_SECONDS) {
              reasons.push('teleportation');
            }

            if (hasUnnaturalVelocityCurve(nextSpeedHistory)) {
              reasons.push('unnatural_velocity_curve');
            }
          }
        }

        hasCompletedInitialForegroundCheckRef.current = true;

        const uniqueReasons = Array.from(new Set(reasons));
        const hasSuddenChangeReason = uniqueReasons.some(isRedSeverityReason);
        const now = Date.now();

        const isLocationWithinInnerRadius = isWithinInnerRadius(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
        );

        if (!cancelled) {
          setState((current) => {
            // Keep red active until rider is back inside working area,
            // then allow 1 minute clean recovery to green.
            let nextFlagLevel: LocationIntegrityFlagLevel;
            let nextRedFlagDetectedAt: number | null = current.redFlagDetectedAt;
            let nextNormalizedAfterRedAt: number | null = current.normalizedAfterRedAt;
            let nextConsecutiveInnerRadiusPoints = consecutiveInnerRadiusPointsRef.current;

            if (hasSuddenChangeReason) {
              // New anomaly detected - reset to red
              nextFlagLevel = 'red';
              nextRedFlagDetectedAt = now; // Start persistence timer
              nextNormalizedAfterRedAt = null; // Clear recovery timer
              nextConsecutiveInnerRadiusPoints = 0; // Restart 5-check window
            } else if (current.flagLevel === 'red' && nextRedFlagDetectedAt !== null) {
              // Flag is already raised - advance recovery window by one GPS check.
              nextConsecutiveInnerRadiusPoints = Math.min(
                nextConsecutiveInnerRadiusPoints + 1,
                DURATION_CHECK_GPS_POINTS,
              );

              if (nextConsecutiveInnerRadiusPoints >= DURATION_CHECK_GPS_POINTS) {
                // At the 5th check, clear to green only if location is within 10 km.
                if (isLocationWithinInnerRadius) {
                  nextFlagLevel = 'green';
                  nextRedFlagDetectedAt = null;
                  nextNormalizedAfterRedAt = null;
                  nextConsecutiveInnerRadiusPoints = DURATION_CHECK_GPS_POINTS;
                } else {
                  // 5 checks completed but still outside 10 km: restart recovery window.
                  nextFlagLevel = 'red';
                  nextConsecutiveInnerRadiusPoints = 0;
                }
              } else {
                // Continue counting checks until the 5th one.
                nextFlagLevel = 'red';
              }
            } else if (uniqueReasons.includes('outside_working_area')) {
              nextFlagLevel = 'yellow';
              nextRedFlagDetectedAt = null; // Clear red flag persistence when downgrading
              nextNormalizedAfterRedAt = null; // Clear recovery timer
              nextConsecutiveInnerRadiusPoints = 0;
            } else {
              nextFlagLevel = 'none';
              nextRedFlagDetectedAt = null; // Clear red flag persistence when clearing
              nextNormalizedAfterRedAt = null; // Clear recovery timer
              nextConsecutiveInnerRadiusPoints = 0;
            }

            consecutiveInnerRadiusPointsRef.current = nextConsecutiveInnerRadiusPoints;

            const newHistory = [...current.history];
            const newAnomalyReasons = uniqueReasons.filter((reason) => !current.reasons.includes(reason));
            newAnomalyReasons.forEach((reason) => {
              newHistory.push({ reason, detectedAt: now });
            });

            const redSeverityNewReasons = newAnomalyReasons.filter(isRedSeverityReason);

            return {
              ...current,
              isFlagged: nextFlagLevel !== 'none',
              flagLevel: nextFlagLevel,
              isChecking: false,
              reasons: uniqueReasons,
              statusText: nextFlagLevel === 'red' && isOutsideWorkingArea
                ? REASON_TEXT.outside_working_area
                : uniqueReasons.length > 0
                  ? REASON_TEXT[uniqueReasons[0]]
                  : nextFlagLevel === 'green'
                    ? 'GPS normal - rider back in working area'
                    : 'GPS normal',
              lastCheckedAt: now,
              redFlagCount: current.redFlagCount + redSeverityNewReasons.length,
              history: newHistory,
              redFlagDetectedAt: nextRedFlagDetectedAt,
              normalizedAfterRedAt: nextNormalizedAfterRedAt,
              consecutiveInnerRadiusPoints: nextConsecutiveInnerRadiusPoints,
            };
          });
        }
      } catch {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            isFlagged: false,
            flagLevel: 'none',
            isChecking: false,
            reasons: [],
            statusText: REASON_TEXT.location_error,
            lastCheckedAt: Date.now(),
            redFlagDetectedAt: null,
            normalizedAfterRedAt: null,
            consecutiveInnerRadiusPoints: 0,
            history: current.history,
          }));
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    setState((current) => ({
      ...current,
      isChecking: true,
      statusText: 'Checking GPS...',
    }));

    void runIntegrityCheck();
    const intervalId = setInterval(() => {
      void runIntegrityCheck();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [enabled, pollIntervalMs]);

  return state;
};
