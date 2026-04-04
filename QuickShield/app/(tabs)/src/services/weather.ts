import * as Location from 'expo-location';

import {
  ensureForegroundLocationPermission,
  getStoredCoordinates,
  LocationPermissionError,
} from './location';

const padNumber = (value: number) => value.toString().padStart(2, '0');

const formatLocalHourKey = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(date.getHours())}:00`;

const resolveCurrentCoordinates = async () => {
  await ensureForegroundLocationPermission();

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new LocationPermissionError(
      'Location services are turned off. Enable GPS to check rain disruption status.',
      'gps_unavailable',
    );
  }

  try {
    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };
  } catch {
    const lastKnownLocation = await Location.getLastKnownPositionAsync({});
    if (lastKnownLocation) {
      return {
        latitude: lastKnownLocation.coords.latitude,
        longitude: lastKnownLocation.coords.longitude,
      };
    }

    const storedCoordinates = await getStoredCoordinates();
    if (storedCoordinates) {
      return {
        latitude: storedCoordinates.latitude,
        longitude: storedCoordinates.longitude,
      };
    }

    throw new Error('Could not determine your current location for rain tracking.');
  }
};

export type CurrentWeatherSnapshot = {
  rainfallRateMmPerHr: number;
  observedAt: string;
};

export const fetchCurrentWeatherSnapshot = async (): Promise<CurrentWeatherSnapshot> => {
  const { latitude, longitude } = await resolveCurrentCoordinates();
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=rain&forecast_days=1&timezone=auto`,
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const hourlyTimes = data?.hourly?.time as string[] | undefined;
  const hourlyRain = data?.hourly?.rain as number[] | undefined;

  if (!hourlyTimes?.length || !hourlyRain?.length) {
    throw new Error('Weather service returned an invalid response.');
  }

  const now = new Date();
  const currentHourKey = formatLocalHourKey(now);
  const matchedIndex = hourlyTimes.indexOf(currentHourKey);
  const fallbackIndex = Math.min(now.getHours(), hourlyRain.length - 1);
  const currentHourIndex = matchedIndex >= 0 ? matchedIndex : fallbackIndex;
  const rainfallRateMmPerHr = Number(hourlyRain[currentHourIndex] ?? 0);

  return {
    rainfallRateMmPerHr,
    observedAt: hourlyTimes[currentHourIndex] ?? currentHourKey,
  };
};
