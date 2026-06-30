import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { keystoneClient } from './keystone';
import { getCache, setCache } from './redis';

interface ServerResponse {
  server: any;
}

interface ServersListResponse {
  servers: any[];
}

class NovaClient {
  private client: AxiosInstance;
  private baseUrl: string | null = null;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      validateStatus: () => true
    });
  }

  private async ensureBaseUrl(): Promise<string> {
    if (this.baseUrl) {
      return this.baseUrl;
    }
    this.baseUrl = await keystoneClient.getServiceEndpoint('compute');
    return this.baseUrl;
  }

  private async makeRequest(
    method: string,
    path: string,
    data?: any,
    retry = true
  ): Promise<any> {
    try {
      const baseUrl = await this.ensureBaseUrl();
      const token = await keystoneClient.getToken();

      const response = await this.client({
        method,
        url: `${baseUrl}${path}`,
        data,
        headers: {
          'X-Auth-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 && retry) {
        this.baseUrl = null;
        return this.makeRequest(method, path, data, false);
      }

      if (response.status >= 400) {
        throw new Error(`Nova API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Nova API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  async createInstance(instanceData: {
    name: string;
    imageId: string;
    flavorId: string;
    networkId: string;
    keypairName?: string;
    securityGroups?: string[];
    metadata?: Record<string, string>;
  }): Promise<any> {
    const payload = {
      server: {
        name: instanceData.name,
        imageRef: instanceData.imageId,
        flavorRef: instanceData.flavorId,
        networks: [
          {
            uuid: instanceData.networkId
          }
        ],
        key_name: instanceData.keypairName,
        security_groups: instanceData.securityGroups?.map(sg => ({ name: sg })) || [],
        metadata: instanceData.metadata || {}
      }
    };

    const response = await this.makeRequest('POST', '/servers', payload);
    logger.info(`Instance created: ${response.server.id}`);
    return response.server;
  }

  async getInstance(instanceId: string): Promise<any> {
    const cacheKey = `nova:instance:${instanceId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.makeRequest('GET', `/servers/${instanceId}`);
    await setCache(cacheKey, response.server, 300);
    return response.server;
  }

  async listInstances(projectId?: string): Promise<any[]> {
    let path = '/servers/detail';
    if (projectId) {
      path += `?project_id=${projectId}`;
    }

    const response = await this.makeRequest('GET', path);
    return response.servers;
  }

  async deleteInstance(instanceId: string): Promise<void> {
    await this.makeRequest('DELETE', `/servers/${instanceId}`);
    logger.info(`Instance deleted: ${instanceId}`);
  }

  async startInstance(instanceId: string): Promise<void> {
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      os-start: null
    });
    logger.info(`Instance started: ${instanceId}`);
  }

  async stopInstance(instanceId: string): Promise<void> {
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      'os-stop': null
    });
    logger.info(`Instance stopped: ${instanceId}`);
  }

  async rebootInstance(instanceId: string, hardReboot = false): Promise<void> {
    const action = hardReboot ? 'HARD' : 'SOFT';
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      reboot: {
        type: action
      }
    });
    logger.info(`Instance rebooted (${action}): ${instanceId}`);
  }

  async pauseInstance(instanceId: string): Promise<void> {
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      pause: null
    });
    logger.info(`Instance paused: ${instanceId}`);
  }

  async unpauseInstance(instanceId: string): Promise<void> {
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      unpause: null
    });
    logger.info(`Instance unpaused: ${instanceId}`);
  }

  async suspendInstance(instanceId: string): Promise<void> {
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      suspend: null
    });
    logger.info(`Instance suspended: ${instanceId}`);
  }

  async resumeInstance(instanceId: string): Promise<void> {
    await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      resume: null
    });
    logger.info(`Instance resumed: ${instanceId}`);
  }

  async getInstanceConsoleUrl(instanceId: string): Promise<string> {
    const response = await this.makeRequest('POST', `/servers/${instanceId}/action`, {
      'os-getVNCConsole': {
        type: 'novnc'
      }
    });
    return response.console.url;
  }

  async listFlavors(): Promise<any[]> {
    const response = await this.makeRequest('GET', '/flavors/detail');
    return response.flavors;
  }

  async getFlavor(flavorId: string): Promise<any> {
    const response = await this.makeRequest('GET', `/flavors/${flavorId}`);
    return response.flavor;
  }
}

export const novaClient = new NovaClient();
