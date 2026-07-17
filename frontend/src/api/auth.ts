/** Auth API calls. */
import api from './client';
import type { Employee } from '../types';

export interface LoginResponse {
  token: string;
  user: Employee;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return { token: data.token, user: data.user };
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  me: async (): Promise<Employee> => {
    const { data } = await api.get('/auth/me');
    return data.user;
  },
};
