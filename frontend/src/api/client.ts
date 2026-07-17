/**
 * Axios instance shared by every API module.
 *
 * - `baseURL` points at the API (via the Vite proxy in dev).
 * - `withCredentials` lets the http-only auth cookie flow with requests.
 * - A response interceptor unwraps errors into a consistent Error with the
 *   server's message, so UI code can just read `error.message`.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
});

// Attach a bearer token if one is stored (fallback for environments where the
// cookie cannot be used, e.g. a cross-site deployment without SameSite=None).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ems_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalise error messages coming back from the API.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'Unexpected network error';
    const details = error.response?.data?.details;
    return Promise.reject(Object.assign(new Error(message), { details, status: error.response?.status }));
  },
);

export default api;
