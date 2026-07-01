import axios, { AxiosInstance } from 'axios';
import { authService, AuthService } from './auth';

export class QuotaService {
  private auth: AuthService;

  constructor(auth: AuthService = authService) {
    this.auth = auth;
  }

  private async getClient(type: string): Promise<AxiosInstance> {
    const url = await this.auth.getServiceUrl(type);
    const token = await this.auth.getToken();
    return axios.create({ baseURL: url, headers: { 'X-Auth-Token': token } });
  }

  async getComputeQuotas(pid: string): Promise<any> {
    const c = await this.getClient('compute');
    const r = await c.get(`/os-quota-sets/${pid}/detail`);
    return r.data.quota_set;
  }

  async getStorageQuotas(pid: string): Promise<any> {
    const c = await this.getClient('volumev3');
    const r = await c.get(`/os-quota-sets/${pid}/detail`);
    return r.data.quota_set;
  }

  async getNetworkQuotas(pid: string): Promise<any> {
    const c = await this.getClient('network');
    const r = await c.get(`/v2.0/quotas/${pid}/details.json`);
    return r.data.quota;
  }

  async validateProvisioning(pid: string, req: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    try {
      const c = await this.getComputeQuotas(pid);
      if (req.vcpus && c.cores.limit !== -1 && (c.cores.in_use + req.vcpus) > c.cores.limit) errors.push('CPU quota exceeded');
      if (req.ram && c.ram.limit !== -1 && (c.ram.in_use + req.ram) > c.ram.limit) errors.push('RAM quota exceeded');

      const s = await this.getStorageQuotas(pid);
      if (req.gigabytes && s.gigabytes.limit !== -1 && (s.gigabytes.in_use + req.gigabytes) > s.gigabytes.limit) errors.push('Storage quota exceeded');
    } catch (e: any) {
      errors.push('Quota check failed: ' + e.message);
    }
    return { valid: errors.length === 0, errors };
  }
}
export const quotaService = new QuotaService();
