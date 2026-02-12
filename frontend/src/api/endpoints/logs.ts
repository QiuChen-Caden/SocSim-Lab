import { request } from '../client';
import type { LogLine, SystemLog, LogLevel } from '../../types';

export const logsApi = {
  async getAll(options?: { limit?: number; offset?: number; level?: LogLevel }): Promise<LogLine[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }
    if (options?.level) {
      params.append('level', options.level);
    }

    const query = params.toString();
    return request<LogLine[]>(`/api/logs${query ? `?${query}` : ''}`);
  },

  async create(data: { tick: number; level: LogLevel; text: string; agentId?: number }): Promise<LogLine> {
    return request<LogLine>('/api/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const systemLogsApi = {
  async getAll(options?: { limit?: number; level?: 'info' | 'ok' | 'error' | 'warn' }): Promise<SystemLog[]> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.level) {
      params.append('level', options.level);
    }

    const query = params.toString();
    return request<SystemLog[]>(`/api/system-logs${query ? `?${query}` : ''}`);
  },
};
