/**
 * API modules for the extended features: audit log, leave, helpdesk tickets,
 * attrition analytics, and the policy assistant. Kept separate from the core
 * employee/org/dashboard calls in `employees.ts`.
 */
import api from './client';
import type {
  AuditLog,
  LeaveRequest,
  LeaveBalance,
  LeaveType,
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  AttritionReport,
  PolicySummary,
  PolicyAnswer,
} from '../types';

export const auditApi = {
  list: async (params: { action?: string; search?: string; page?: number } = {}): Promise<AuditLog[]> => {
    const { data } = await api.get('/audit', { params });
    return data.data;
  },
};

export const leaveApi = {
  list: async (status?: string): Promise<LeaveRequest[]> => {
    const { data } = await api.get('/leave', { params: status ? { status } : {} });
    return data.data;
  },
  balance: async (): Promise<LeaveBalance[]> => {
    const { data } = await api.get('/leave/balance');
    return data.data;
  },
  create: async (payload: { type: LeaveType; startDate: string; endDate: string; reason?: string }): Promise<LeaveRequest> => {
    const { data } = await api.post('/leave', payload);
    return data.data;
  },
  decide: async (id: string, decision: 'approved' | 'rejected', reviewNote = ''): Promise<LeaveRequest> => {
    const { data } = await api.patch(`/leave/${id}/decision`, { decision, reviewNote });
    return data.data;
  },
  cancel: async (id: string): Promise<void> => {
    await api.patch(`/leave/${id}/cancel`);
  },
};

export const ticketApi = {
  list: async (params: { status?: string; category?: string } = {}): Promise<Ticket[]> => {
    const { data } = await api.get('/tickets', { params });
    return data.data;
  },
  get: async (id: string): Promise<Ticket> => {
    const { data } = await api.get(`/tickets/${id}`);
    return data.data;
  },
  create: async (payload: { subject: string; description: string; category: TicketCategory; priority: TicketPriority }): Promise<Ticket> => {
    const { data } = await api.post('/tickets', payload);
    return data.data;
  },
  update: async (id: string, payload: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory; assignedTo?: string | null }): Promise<Ticket> => {
    const { data } = await api.patch(`/tickets/${id}`, payload);
    return data.data;
  },
  comment: async (id: string, body: string): Promise<Ticket> => {
    const { data } = await api.post(`/tickets/${id}/comments`, { body });
    return data.data;
  },
};

export const analyticsApi = {
  attrition: async (): Promise<AttritionReport> => {
    const { data } = await api.get('/analytics/attrition');
    return data.data;
  },
};

export const policyApi = {
  list: async (): Promise<PolicySummary[]> => {
    const { data } = await api.get('/policies');
    return data.data;
  },
  ask: async (question: string): Promise<PolicyAnswer> => {
    const { data } = await api.post('/policies/ask', { question });
    return data.data;
  },
};
