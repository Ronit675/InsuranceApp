import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoPublicEnvName =
  | 'EXPO_PUBLIC_API_URL'
  | 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID';

const readExpoPublicEnv = (name: ExpoPublicEnvName) => {
  const value =
    name === 'EXPO_PUBLIC_API_URL'
      ? process.env.EXPO_PUBLIC_API_URL
      : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const isLoopbackUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
};

export const getRequiredExpoPublicEnv = (name: ExpoPublicEnvName) => {
  const value = readExpoPublicEnv(name);
  if (!value) {
    throw new Error(`Missing required app config: ${name}`);
  }

  return value;
};

const getExpoHostBaseUrl = () => {
  const possibleHostUri =
    Constants.expoConfig?.hostUri
    ?? (Constants as typeof Constants & {
      expoGoConfig?: { debuggerHost?: string };
      manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    }).expoGoConfig?.debuggerHost
    ?? (Constants as typeof Constants & {
      manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    }).manifest2?.extra?.expoClient?.hostUri;

  const host = possibleHostUri?.split(':')[0];
  return host ? `http://${host}:3000` : 'http://127.0.0.1:3000';
};

export const getConfiguredApiBaseUrl = () => {
  if (__DEV__) {
    const configuredUrl = readExpoPublicEnv('EXPO_PUBLIC_API_URL');

    if (configuredUrl) {
      if (Platform.OS !== 'web' && isLoopbackUrl(configuredUrl)) {
        return getExpoHostBaseUrl();
      }

      return configuredUrl;
    }

    return getExpoHostBaseUrl();
  }

  return getRequiredExpoPublicEnv('EXPO_PUBLIC_API_URL');
};
