import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const getDevBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

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
  return host ? `http://${host}:3000` : 'http://localhost:3000';
};

const BASE_URL = __DEV__ ? getDevBaseUrl() : 'https://your-prod-url.com';

const api = axios.create({ baseURL: BASE_URL });

// Attach stored JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and let the app navigate to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('accessToken');
    }
    return Promise.reject(error);
  },
);

export default api;
