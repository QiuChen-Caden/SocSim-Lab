import { request } from '../client';
import type { FeedPost } from '../../types';

export const feedApi = {
  async getAll(options?: {
    limit?: number;
    offset?: number;
    sort?: 'time' | 'emotion' | 'likes';
  }): Promise<FeedPost[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }
    if (options?.sort) {
      params.append('sort', options.sort);
    }

    const query = params.toString();
    return request<FeedPost[]>(`/api/feed${query ? `?${query}` : ''}`);
  },

  async create(data: {
    agentId: number;
    content: string;
    emotion?: number;
  }): Promise<FeedPost> {
    return request<FeedPost>('/api/feed', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
