import axios, { AxiosInstance } from 'axios';
import { authService, AuthService } from './auth';

export class StorageService {
  private client: AxiosInstance;
  private auth: AuthService;
  private baseUrl: string | null = null;

  constructor(auth: AuthService = authService) {
    this.auth = auth;
    this.client = axios.create({ timeout: 30000 });
  }

  private async getClient(): Promise<AxiosInstance> {
    if (!this.baseUrl) this.baseUrl = await this.auth.getServiceUrl('volumev3');
    this.client.defaults.headers.common['X-Auth-Token'] = await this.auth.getToken();
    this.client.defaults.baseURL = this.baseUrl;
    return this.client;
  }

  async listVolumes(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/volumes/detail');
    return r.data.volumes;
  }

  async createVolume(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/volumes', { volume: p });
    return r.data.volume;
  }

  async getVolume(id: string): Promise<any> {
    const c = await this.getClient();
    const r = await c.get(`/volumes/${id}`);
    return r.data.volume;
  }

  async deleteVolume(id: string): Promise<void> {
    const c = await this.getClient();
    await c.delete(`/volumes/${id}`);
  }

  async extendVolume(id: string, newSize: number): Promise<void> {
    const c = await this.getClient();
    await c.post(`/volumes/${id}/action`, { 'os-extend': { new_size: newSize } });
  }

  async createSnapshot(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/snapshots', { snapshot: p });
    return r.data.snapshot;
  }

  async getSnapshot(id: string): Promise<any> {
    const c = await this.getClient();
    const r = await c.get(`/snapshots/${id}`);
    return r.data.snapshot;
  }

  async listSnapshots(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/snapshots/detail');
    return r.data.snapshots;
  }

  async createBackup(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/backups', { backup: p });
    return r.data.backup;
  }

  async restoreBackup(id: string, p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post(`/backups/${id}/restore`, { restore: p });
    return r.data.restore;
  }

  async listBackups(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/backups/detail');
    return r.data.backups;
  }
}
export const storageService = new StorageService();
