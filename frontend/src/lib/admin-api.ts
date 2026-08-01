import axios from 'axios';

const ADMIN_TOKEN_KEY = 'admin_access_token';

const adminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
});

adminApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  },
);

export { ADMIN_TOKEN_KEY };
export default adminApi;
