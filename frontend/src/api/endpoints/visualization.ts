import { request } from '../client';

export const visualizationApi = {
  async getLayout(algorithm: 'force_directed' | 'circular' | 'grid' = 'force_directed'): Promise<{
    positions: Record<number, { x: number; y: number }>;
    algorithm: string;
  }> {
    return request(`/api/visualization/layout?algorithm=${algorithm}`);
  },

  async getNetwork(options?: { limit?: number }): Promise<{
    edges: Array<{ source: number; target: number; kind: 'follow' | 'group' | 'message'; strength: number }>;
    source: string;
    error?: string;
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return request(`/api/visualization/network${query ? `?${query}` : ''}`);
  },
};
