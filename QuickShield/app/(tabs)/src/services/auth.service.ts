import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import api from './api';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const getGoogleSignInModule = () => {
  if (isExpoGo) {
    throw new Error(
      'This app uses native Google Sign-In and cannot complete login inside Expo Go. Install a development build on your Android phone instead.',
    );
  }

  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
};

export const configureGoogleSignIn = () => {
  if (isExpoGo) {
    return;
  }

  const { GoogleSignin } = getGoogleSignInModule();

  GoogleSignin.configure({
    // Must be the WEB client ID, not the Android one
    webClientId: '236663446258-9tvhq82dh2q4r5mpbkion5ld5gv4kc5i.apps.googleusercontent.com',
    offlineAccess: false,
  });
};

export interface AuthUser {
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
}

export const signInWithGoogle = async (): Promise<AuthUser> => {
  const { GoogleSignin, isSuccessResponse } = getGoogleSignInModule();

  await GoogleSignin.hasPlayServices();
  const googleResponse = await GoogleSignin.signIn();

  if (!isSuccessResponse(googleResponse)) {
    throw new Error('Google sign-in was cancelled');
  }

  const { idToken } = googleResponse.data;

  if (!idToken) {
    throw new Error('No ID token returned from Google');
  }

  // Exchange Google token for our own JWT
  const apiResponse = await api.post('/auth/google', { idToken });
  const { accessToken, user } = apiResponse.data;

  await AsyncStorage.setItem('accessToken', accessToken);
  return user;
};

export const requestPhoneOtp = async (phone: string) => {
  const response = await api.post('/auth/phone/send-otp', { phone });
  return response.data as {
    success: boolean;
    phone: string;
    expiresInSeconds: number;
    debugOtp?: string;
    delivery: 'debug' | 'pending_sms_setup';
  };
};

export const signInWithPhoneOtp = async (phone: string, otp: string): Promise<AuthUser> => {
  const response = await api.post('/auth/phone/verify-otp', { phone, otp });
  const { accessToken, user } = response.data;

  await AsyncStorage.setItem('accessToken', accessToken);
  return user;
};

export const restoreSession = async (): Promise<AuthUser | null> => {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) return null;

  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch {
    await AsyncStorage.removeItem('accessToken');
    return null;
  }
};

export const signOut = async () => {
  await AsyncStorage.removeItem('accessToken');

  if (isExpoGo) {
    return;
  }

  const { GoogleSignin } = getGoogleSignInModule();

  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google sign-out errors
  }
};

export const updateProfileDetails = async (payload: {
  fullName: string;
  dateOfBirth: string;
  address: string;
  email: string;
  profilePhoto?: string | null;
}): Promise<AuthUser> => {
  const response = await api.put('/profile/details', payload);
  return response.data.user;
};

export const updateSelectedPlatform = async (platform: string): Promise<AuthUser> => {
  const response = await api.post('/profile/platform', { platform });
  return response.data.user;
};

export const connectSelectedPlatform = async (): Promise<{
  verified: boolean;
  averageDailyIncome: number;
  message: string;
  user: AuthUser;
}> => {
  const response = await api.post('/profile/platform/connect');
  return response.data;
};

export const disconnectSelectedPlatform = async (): Promise<{
  disconnected: boolean;
  message: string;
  user: AuthUser;
}> => {
  const response = await api.post('/profile/platform/disconnect');
  return response.data;
};

const authService = {
  configureGoogleSignIn,
  signInWithGoogle,
  requestPhoneOtp,
  signInWithPhoneOtp,
  restoreSession,
  signOut,
  updateProfileDetails,
  updateSelectedPlatform,
  connectSelectedPlatform,
  disconnectSelectedPlatform,
};

export default authService;
