import { request } from '../client';
import type { InterventionRecord } from '../../types';

export const interventionsApi = {
  async getAll(options?: { limit?: number; offset?: number }): Promise<InterventionRecord[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const query = params.toString();
    return request<InterventionRecord[]>(`/api/interventions${query ? `?${query}` : ''}`);
  },

  async create(data: { tick: number; command: string; targetAgentId?: number }): Promise<InterventionRecord> {
    return request<InterventionRecord>('/api/intervention', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
