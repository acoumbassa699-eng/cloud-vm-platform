import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { getCache, setCache } from '../../services/redis';

export interface OpenStackAuthConfig {
  authUrl: string;
  username: string;
  password: string;
  domain: string;
  projectName?: string;
  projectId?: string;
  region: string;
}

export interface TokenInfo {
  token: string;
  expiresAt: string;
  catalog: any[];
}

export class AuthService {
  private client: AxiosInstance;
  private config: OpenStackAuthConfig;
  private currentToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config?: Partial<OpenStackAuthConfig>) {
    this.config = {
      authUrl: config?.authUrl || process.env.OPENSTACK_AUTH_URL || 'http://localhost:5000/v3',
      username: config?.username || process.env.OPENSTACK_USERNAME || 'admin',
      password: config?.password || process.env.OPENSTACK_PASSWORD || 'admin',
      domain: config?.domain || process.env.OPENSTACK_DOMAIN || 'Default',
      projectName: config?.projectName || process.env.OPENSTACK_PROJECT_NAME || 'admin',
      projectId: config?.projectId || process.env.OPENSTACK_PROJECT_ID,
      region: config?.region || process.env.OPENSTACK_REGION || 'RegionOne',
    };
    this.client = axios.create({ baseURL: this.config.authUrl, timeout: 10000 });
  }

  async authenticate(force = false): Promise<TokenInfo> {
    const cacheKey = `openstack:token:${this.config.username}:${this.config.projectName || this.config.projectId}`;
    if (!force) {
      const cached = await getCache(cacheKey);
      if (cached && new Date(cached.expiresAt).getTime() > Date.now() + 300000) {
        this.currentToken = cached.token;
        this.tokenExpiry = new Date(cached.expiresAt);
        return cached;
      }
    }

    const authPayload: any = {
      auth: {
        identity: {
          methods: ['password'],
          password: { user: { name: this.config.username, domain: { name: this.config.domain }, password: this.config.password } }
        }
      }
    };
    if (this.config.projectId) authPayload.auth.scope = { project: { id: this.config.projectId } };
    else if (this.config.projectName) authPayload.auth.scope = { project: { name: this.config.projectName, domain: { name: this.config.domain } } };

    const response = await this.client.post('/auth/tokens', authPayload);
    const info: TokenInfo = {
      token: response.headers['x-subject-token'],
      expiresAt: response.data.token.expires_at,
      catalog: response.data.token.catalog
    };

    this.currentToken = info.token;
    this.tokenExpiry = new Date(info.expiresAt);
    const ttl = Math.floor((this.tokenExpiry.getTime() - Date.now()) / 1000) - 60;
    if (ttl > 0) await setCache(cacheKey, info, ttl);
    return info;
  }

  async getToken(): Promise<string> {
    if (!this.currentToken || !this.tokenExpiry || this.tokenExpiry.getTime() <= Date.now() + 30000) {
      await this.authenticate();
    }
    return this.currentToken!;
  }

  async getServiceUrl(serviceType: string): Promise<string> {
    const info = await this.authenticate();
    const service = info.catalog.find((s: any) => s.type === serviceType);
    if (!service) throw new Error(`Service ${serviceType} not found`);
    const endpoint = service.endpoints.find((e: any) => e.interface === 'public' && (e.region === this.config.region || !e.region));
    if (!endpoint) throw new Error(`Endpoint for ${serviceType} not found`);
    return endpoint.url;
  }
}
export const authService = new AuthService();
