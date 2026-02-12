import { request } from '../client';
import type { TimelineEvent, EventType } from '../../types';

export const eventsApi = {
  async getAll(options?: { limit?: number; offset?: number }): Promise<TimelineEvent[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const query = params.toString();
    return request<TimelineEvent[]>(`/api/events${query ? `?${query}` : ''}`);
  },

  async create(data: {
    tick: number;
    type: EventType;
    title: string;
    agentId?: number;
    payload?: Record<string, unknown>;
  }): Promise<TimelineEvent> {
    return request<TimelineEvent>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
