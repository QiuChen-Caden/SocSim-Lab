import { request } from '../client';
import type { AgentProfile, AgentState } from '../../types';

export const agentsApi = {
  async getAll(options?: {
    ids?: number[];
    limit?: number;
    offset?: number;
  }): Promise<AgentProfile[]> {
    const params = new URLSearchParams();
    if (options?.ids) {
      params.append('ids', options.ids.join(','));
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const query = params.toString();
    return request<AgentProfile[]>(`/api/agents${query ? `?${query}` : ''}`);
  },

  async getById(id: number): Promise<AgentProfile> {
    return request<AgentProfile>(`/api/agents/${id}`);
  },

  async getByIds(ids: number[]): Promise<AgentProfile[]> {
    if (ids.length === 0) return [];
    return this.getAll({ ids });
  },

  async getState(id: number): Promise<AgentState> {
    return request<AgentState>(`/api/agents/${id}/state`);
  },

  async patchState(
    id: number,
    updates: Partial<Pick<AgentState, 'mood' | 'stance' | 'resources' | 'lastAction'>>
  ): Promise<void> {
    await request(`/api/agents/${id}/state`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};
