import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export interface OpenStackToken {
  token: string;
  expiresAt: Date;
}

export interface OpenStackProject {
  id: string;
  name: string;
  enabled: boolean;
}

export class OpenStackClient {
  private client: AxiosInstance;
  private token: OpenStackToken | null = null;
  private authUrl: string;
  private username: string;
  private password: string;
  private projectName: string;
  private domain: string;
  private region: string;

  constructor() {
    this.authUrl = process.env.OPENSTACK_AUTH_URL || 'http://localhost:5000/v3';
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

  async authenticate(): Promise<void> {
    try {
      const response = await this.client.post('/auth/tokens', {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: this.username,
                domain: { name: this.domain },
                password: this.password
              }
            }
          },
          scope: {
            project: {
              name: this.projectName,
              domain: { name: this.domain }
            }
          }
        }
      });

      if (response.status !== 201) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const token = response.headers['x-subject-token'];
      const expiresAt = new Date(response.data.token.expires_at);

      this.token = { token, expiresAt };
      this.client.defaults.headers.common['X-Auth-Token'] = token;

      logger.info('OpenStack authentication successful');
    } catch (error) {
      logger.error('OpenStack authentication failed:', error);
      throw error;
    }
  }

  async ensureAuthenticated(): Promise<void> {
    if (!this.token || new Date() >= this.token.expiresAt) {
      await this.authenticate();
    }
  }

  async getServiceUrl(service: string, interface_type: string = 'public'): Promise<string> {
    await this.ensureAuthenticated();

    const response = await this.client.get('/auth/tokens', {
      headers: { 'X-Subject-Token': this.token!.token }
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get service URL: ${response.status}`);
    }

    const catalog = response.data.token.catalog;
    const serviceEntry = catalog.find((s: any) => s.type === service);

    if (!serviceEntry) {
      throw new Error(`Service ${service} not found in catalog`);
    }

    const endpoint = serviceEntry.endpoints.find(
      (e: any) => e.region === this.region && e.interface === interface_type
    );

    if (!endpoint) {
      throw new Error(`Endpoint not found for ${service} in region ${this.region}`);
    }

    return endpoint.url;
  }

  getClient(): AxiosInstance {
    return this.client;
  }

  getRegion(): string {
    return this.region;
  }
}

export const openstackClient = new OpenStackClient();
