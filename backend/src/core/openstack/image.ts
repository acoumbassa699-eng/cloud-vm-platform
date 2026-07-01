import axios, { AxiosInstance } from 'axios';
import { authService, AuthService } from './auth';

export class ImageService {
  private client: AxiosInstance;
  private auth: AuthService;
  private baseUrl: string | null = null;

  constructor(auth: AuthService = authService) {
    this.auth = auth;
    this.client = axios.create({ timeout: 30000 });
  }

  private async getClient(): Promise<AxiosInstance> {
    if (!this.baseUrl) this.baseUrl = await this.auth.getServiceUrl('image');
    this.client.defaults.headers.common['X-Auth-Token'] = await this.auth.getToken();
    this.client.defaults.baseURL = this.baseUrl;
    return this.client;
  }

  async listImages(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2/images');
    return r.data.images;
  }

  async getImage(id: string): Promise<any> {
    const c = await this.getClient();
    const r = await c.get(`/v2/images/${id}`);
    return r.data;
  }

  async createImage(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2/images', p);
    return r.data;
  }

  async uploadImage(id: string, data: any): Promise<void> {
    const c = await this.getClient();
    await c.put(`/v2/images/${id}/file`, data, { headers: { 'Content-Type': 'application/octet-stream' } });
  }

  async updateImage(id: string, patches: any[]): Promise<any> {
    const c = await this.getClient();
    const r = await c.patch(`/v2/images/${id}`, patches, { headers: { 'Content-Type': 'application/openstack-images-v2.1-json-patch' } });
    return r.data;
  }

  async deleteImage(id: string): Promise<void> {
    const c = await this.getClient();
    await c.delete(`/v2/images/${id}`);
  }
}
export const imageService = new ImageService();
