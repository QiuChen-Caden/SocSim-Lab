import { request } from '../client';
import type { SimulationSnapshot, SimulationState } from '../../types';

export const snapshotsApi = {
  async getAll(): Promise<SimulationSnapshot[]> {
    return request<SimulationSnapshot[]>('/api/snapshots');
  },

  async create(name: string): Promise<SimulationSnapshot> {
    return request<SimulationSnapshot>('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async getById(id: string): Promise<SimulationSnapshot & { data: SimulationState }> {
    return request<SimulationSnapshot & { data: SimulationState }>(`/api/snapshots/${id}`);
  },

  async load(id: string): Promise<void> {
    await request(`/api/snapshots/${id}/load`, { method: 'POST' });
  },

  async delete(id: string): Promise<void> {
    await request(`/api/snapshots/${id}`, { method: 'DELETE' });
  },
};
