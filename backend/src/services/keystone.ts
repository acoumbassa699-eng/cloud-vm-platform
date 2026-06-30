import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { getCache, setCache } from './redis';

interface KeystoneToken {
  token: string;
  expiresAt: number;
}

interface AuthProject {
  id: string;
  name: string;
}

class KeystoneClient {
  private client: AxiosInstance;
  private authUrl: string;
  private username: string;
  private password: string;
  private projectName: string;
  private domain: string;
  private region: string;
  private token: KeystoneToken | null = null;

  constructor() {
    this.authUrl = process.env.OPENSTACK_AUTH_URL || 'http://openstack-controller:5000/v3';
    this.username = process.env.OPENSTACK_USERNAME || 'admin';
    this.password = process.env.OPENSTACK_PASSWORD || 'admin';
    this.projectName = process.env.OPENSTACK_PROJECT || 'admin';
    this.domain = process.env.OPENSTACK_DOMAIN || 'Default';
    this.region = process.env.OPENSTACK_REGION || 'RegionOne';

    this.client = axios.create({
      baseURL: this.authUrl,
      timeout: 30000,
      validateStatus: () => true
    });
  }

  async authenticate(): Promise<string> {
    try {
      const cachedToken = await getCache('openstack:token');
      if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
        return cachedToken.token;
      }

      const response = await this.client.post('/auth/tokens', {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: this.username,
                domain: {
                  name: this.domain
                },
                password: this.password
              }
            }
          },
          scope: {
            project: {
              name: this.projectName,
              domain: {
                name: this.domain
              }
            }
          }
        }
      });

      if (response.status !== 201) {
        throw new Error(`Authentication failed with status ${response.status}`);
      }

      const token = response.headers['x-subject-token'];
      const expiresAt = Date.parse(response.data.token.expires_at);

      this.token = { token, expiresAt };

      await setCache('openstack:token', { token, expiresAt }, 3600);

      logger.info('OpenStack authentication successful');
      return token;
    } catch (error) {
      logger.error('OpenStack authentication failed:', error);
      throw error;
    }
  }

  async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60000) {
      return this.token.token;
    }
    return this.authenticate();
  }

  async getServiceEndpoint(serviceName: string): Promise<string> {
    const token = await this.getToken();

    const response = await this.client.get('/auth/tokens', {
      headers: {
        'X-Auth-Token': token,
        'X-Subject-Token': token
      }
    });

    const catalog = response.data.token.catalog;
    const service = catalog.find((s: any) => s.type === serviceName);

    if (!service) {
      throw new Error(`Service ${serviceName} not found in catalog`);
    }

    const endpoint = service.endpoints.find(
      (e: any) => e.region === this.region && e.interface === 'public'
    );

    if (!endpoint) {
      throw new Error(`Endpoint for ${serviceName} not found in region ${this.region}`);
    }

    return endpoint.url;
  }
}

export const keystoneClient = new KeystoneClient();
