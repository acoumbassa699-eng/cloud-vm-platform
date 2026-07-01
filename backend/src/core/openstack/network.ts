import axios, { AxiosInstance } from 'axios';
import { authService, AuthService } from './auth';

export class NetworkService {
  private client: AxiosInstance;
  private auth: AuthService;
  private baseUrl: string | null = null;

  constructor(auth: AuthService = authService) {
    this.auth = auth;
    this.client = axios.create({ timeout: 30000 });
  }

  private async getClient(): Promise<AxiosInstance> {
    if (!this.baseUrl) this.baseUrl = await this.auth.getServiceUrl('network');
    this.client.defaults.headers.common['X-Auth-Token'] = await this.auth.getToken();
    this.client.defaults.baseURL = this.baseUrl;
    return this.client;
  }

  async listNetworks(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2.0/networks');
    return r.data.networks;
  }

  async createNetwork(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2.0/networks', { network: p });
    return r.data.network;
  }

  async listSubnets(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2.0/subnets');
    return r.data.subnets;
  }

  async createSubnet(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2.0/subnets', { subnet: p });
    return r.data.subnet;
  }

  async listRouters(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2.0/routers');
    return r.data.routers;
  }

  async createRouter(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2.0/routers', { router: p });
    return r.data.router;
  }

  async addRouterInterface(routerId: string, p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.put(`/v2.0/routers/${routerId}/add_router_interface`, p);
    return r.data;
  }

  async listPorts(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2.0/ports');
    return r.data.ports;
  }

  async createPort(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2.0/ports', { port: p });
    return r.data.port;
  }

  async listFloatingIps(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2.0/floatingips');
    return r.data.floatingips;
  }

  async createFloatingIp(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2.0/floatingips', { floatingip: p });
    return r.data.floatingip;
  }

  async listSecurityGroups(): Promise<any[]> {
    const c = await this.getClient();
    const r = await c.get('/v2.0/security-groups');
    return r.data.security_groups;
  }

  async createSecurityGroupRule(p: any): Promise<any> {
    const c = await this.getClient();
    const r = await c.post('/v2.0/security-group-rules', { security_group_rule: p });
    return r.data.security_group_rule;
  }
}
export const networkService = new NetworkService();
