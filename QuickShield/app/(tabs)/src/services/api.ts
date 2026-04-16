import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConfiguredApiBaseUrl } from './runtime-config';

const BASE_URL = getConfiguredApiBaseUrl();

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
