import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const isProd = import.meta.env.PROD;

const api = axios.create({
  baseURL: isProd
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'
});

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(res => res, async err => {
  if (err.response?.status === 403) {
    const { refreshToken, setAccessToken, logout } = useAuthStore.getState();
    if (!refreshToken) { logout(); return Promise.reject(err); }
    try {
      const base = isProd ? `${import.meta.env.VITE_API_URL}` : '';
      const { data } = await axios.post(`${base}/api/auth/refresh`, { refreshToken });
      setAccessToken(data.accessToken);
      err.config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(err.config);
    } catch { logout(); }
  }
  return Promise.reject(err);
});

export default api;