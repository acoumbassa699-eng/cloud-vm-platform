import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { keystoneClient } from './keystone';
import { getCache, setCache } from './redis';

class CinderClient {
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
    this.baseUrl = await keystoneClient.getServiceEndpoint('volumev3');
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
        throw new Error(`Cinder API error: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Cinder API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  async createVolume(volumeData: {
    name: string;
    size: number;
    volumeType?: string;
    description?: string;
  }): Promise<any> {
    const payload = {
      volume: {
        name: volumeData.name,
        size: volumeData.size,
        volume_type: volumeData.volumeType || 'ceph',
        description: volumeData.description || ''
      }
    };

    const response = await this.makeRequest('POST', '/volumes', payload);
    logger.info(`Volume created: ${response.volume.id}`);
    return response.volume;
  }

  async getVolume(volumeId: string): Promise<any> {
    const cacheKey = `cinder:volume:${volumeId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.makeRequest('GET', `/volumes/${volumeId}`);
    await setCache(cacheKey, response.volume, 300);
    return response.volume;
  }

  async listVolumes(projectId?: string): Promise<any[]> {
    let path = '/volumes/detail';
    if (projectId) {
      path += `?project_id=${projectId}`;
    }

    const response = await this.makeRequest('GET', path);
    return response.volumes;
  }

  async deleteVolume(volumeId: string): Promise<void> {
    await this.makeRequest('DELETE', `/volumes/${volumeId}`);
    logger.info(`Volume deleted: ${volumeId}`);
  }

  async attachVolume(volumeId: string, instanceId: string): Promise<any> {
    const payload = {
      attachment: {
        instance_uuid: instanceId,
        volume_id: volumeId
      }
    };

    const response = await this.makeRequest('POST', `/volumes/${volumeId}/action`, {
      os_attach: payload.attachment
    });
    logger.info(`Volume attached: ${volumeId} to instance ${instanceId}`);
    return response;
  }

  async detachVolume(volumeId: string): Promise<void> {
    await this.makeRequest('POST', `/volumes/${volumeId}/action`, {
      os_detach: {}
    });
    logger.info(`Volume detached: ${volumeId}`);
  }

  async createSnapshot(snapshotData: {
    volumeId: string;
    name: string;
    description?: string;
  }): Promise<any> {
    const payload = {
      snapshot: {
        volume_id: snapshotData.volumeId,
        name: snapshotData.name,
        description: snapshotData.description || ''
      }
    };

    const response = await this.makeRequest('POST', '/snapshots', payload);
    logger.info(`Snapshot created: ${response.snapshot.id}`);
    return response.snapshot;
  }

  async getSnapshot(snapshotId: string): Promise<any> {
    const response = await this.makeRequest('GET', `/snapshots/${snapshotId}`);
    return response.snapshot;
  }

  async listSnapshots(projectId?: string): Promise<any[]> {
    let path = '/snapshots/detail';
    if (projectId) {
      path += `?project_id=${projectId}`;
    }

    const response = await this.makeRequest('GET', path);
    return response.snapshots;
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.makeRequest('DELETE', `/snapshots/${snapshotId}`);
    logger.info(`Snapshot deleted: ${snapshotId}`);
  }
}

export const cinderClient = new CinderClient();
