import axios, { AxiosInstance } from 'axios';
import { authService, AuthService } from './auth';

export class ComputeService {
  private client: AxiosInstance;
  private auth: AuthService;
  private baseUrl: string | null = null;

  constructor(auth: AuthService = authService) {
    this.auth = auth;
    this.client = axios.create({ timeout: 30000 });
  }

  private async getClient(): Promise<AxiosInstance> {
    if (!this.baseUrl) this.baseUrl = await this.auth.getServiceUrl('compute');
    this.client.defaults.headers.common['X-Auth-Token'] = await this.auth.getToken();
    this.client.defaults.baseURL = this.baseUrl;
    return this.client;
  }

  async listServers(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/servers/detail');
    return r.data.servers;
  }

  async getServer(id: string): Promise<any> {
    const c = await this.getClient();
    const r = await c.get(`/servers/${id}`);
    return r.data.server;
  }

  async createServer(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/servers', { server: p });
    return r.data.server;
  }

  async deleteServer(id: string): Promise<void> {
    const c = await this.getClient();
    await c.delete(`/servers/${id}`);
  }

  async action(id: string, action: string, body: any = null): Promise<any> {
    const c = await this.getClient();
    const r = await c.post(`/servers/${id}/action`, { [action]: body });
    return r.data;
  }

  async startServer(id: string) { await this.action(id, 'os-start'); }
  async stopServer(id: string) { await this.action(id, 'os-stop'); }
  async rebootServer(id: string, type: string = 'SOFT') { await this.action(id, 'reboot', { type }); }
  async pauseServer(id: string) { await this.action(id, 'pause'); }
  async unpauseServer(id: string) { await this.action(id, 'unpause'); }
  async suspendServer(id: string) { await this.action(id, 'suspend'); }
  async resumeServer(id: string) { await this.action(id, 'resume'); }

  async resizeServer(id: string, flavorRef: string) { await this.action(id, 'resize', { flavorRef }); }
  async confirmResize(id: string) { await this.action(id, 'confirmResize'); }
  async revertResize(id: string) { await this.action(id, 'revertResize'); }

  async rescueServer(id: string, adminPass?: string, imageRef?: string) {
    await this.action(id, 'rescue', { adminPass, rescue_image_ref: imageRef });
  }
  async unrescueServer(id: string) { await this.action(id, 'unrescue'); }

  async rebuildServer(id: string, imageRef: string, adminPass?: string, metadata?: any) {
    await this.action(id, 'rebuild', { imageRef, adminPass, metadata });
  }

  async getConsoleUrl(id: string, type: string = 'novnc'): Promise<string> {
    const r = await this.action(id, 'os-getVNCConsole', { type });
    return r.console.url;
  }

  async getConsoleLogs(id: string, length?: number): Promise<string> {
    const r = await this.action(id, 'os-getConsoleOutput', { length });
    return r.output;
  }

  async getFlavor(id: string): Promise<any> {
    const c = await this.getClient();
    const r = await c.get(`/flavors/${id}`);
    return r.data.flavor;
  }

  async listFlavors(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/flavors/detail');
    return r.data.flavors;
  }
}
export const computeService = new ComputeService();
