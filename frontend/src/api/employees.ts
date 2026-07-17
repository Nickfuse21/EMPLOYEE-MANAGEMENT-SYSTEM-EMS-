/** Employee, organisation, and dashboard API calls. */
import api from './client';
import type {
  Employee,
  EmployeeQuery,
  Pagination,
  OrgNode,
  DashboardStats,
  MyTeam,
} from '../types';

export interface EmployeeListResult {
  data: Employee[];
  pagination: Pagination;
}

export const employeeApi = {
  /** List employees with search / filter / sort / pagination. */
  list: async (query: EmployeeQuery = {}): Promise<EmployeeListResult> => {
    // Drop empty params so the URL stays clean.
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    );
    const { data } = await api.get('/employees', { params });
    return { data: data.data, pagination: data.pagination };
  },

  get: async (id: string): Promise<Employee> => {
    const { data } = await api.get(`/employees/${id}`);
    return data.data;
  },

  create: async (payload: Partial<Employee> & { password?: string }): Promise<Employee> => {
    const { data } = await api.post('/employees', payload);
    return data.data;
  },

  update: async (id: string, payload: Partial<Employee> & { password?: string }): Promise<Employee> => {
    const { data } = await api.put(`/employees/${id}`, payload);
    return data.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/employees/${id}`);
  },

  reportees: async (id: string): Promise<Employee[]> => {
    const { data } = await api.get(`/employees/${id}/reportees`);
    return data.data;
  },

  assignManager: async (id: string, reportingManager: string | null): Promise<Employee> => {
    const { data } = await api.patch(`/employees/${id}/manager`, { reportingManager });
    return data.data;
  },
};

export const orgApi = {
  tree: async (): Promise<OrgNode[]> => {
    const { data } = await api.get('/organization/tree');
    return data.data;
  },

  myTeam: async (): Promise<MyTeam> => {
    const { data } = await api.get('/organization/my-team');
    return data.data;
  },
};

export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats');
    return data.data;
  },
};
