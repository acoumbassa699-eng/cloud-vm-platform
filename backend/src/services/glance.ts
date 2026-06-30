import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { keystoneClient } from './keystone';
import { getCache, setCache } from './redis';

class GlanceClient {
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
    this.baseUrl = await keystoneClient.getServiceEndpoint('image');
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
        throw new Error(`Glance API error: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Glance API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  async listImages(filters?: Record<string, any>): Promise<any[]> {
    const cacheKey = 'glance:images:list';
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    let path = '/v2/images';
    if (filters) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, value);
      });
      path += `?${params.toString()}`;
    }

    const response = await this.makeRequest('GET', path);
    const images = response.images || [];
    await setCache(cacheKey, images, 1800);
    return images;
  }

  async getImage(imageId: string): Promise<any> {
    const cacheKey = `glance:image:${imageId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.makeRequest('GET', `/v2/images/${imageId}`);
    await setCache(cacheKey, response, 1800);
    return response;
  }

  async createImage(imageData: {
    name: string;
    diskFormat: string;
    containerFormat: string;
    visibility?: string;
    tags?: string[];
  }): Promise<any> {
    const payload = {
      name: imageData.name,
      disk_format: imageData.diskFormat,
      container_format: imageData.containerFormat,
      visibility: imageData.visibility || 'private',
      tags: imageData.tags || []
    };

    const response = await this.makeRequest('POST', '/v2/images', payload);
    logger.info(`Image created: ${response.id}`);
    return response;
  }

  async updateImage(imageId: string, updates: Record<string, any>): Promise<any> {
    const operations = Object.entries(updates).map(([key, value]) => ({
      op: 'replace',
      path: `/${key}`,
      value
    }));

    const response = await this.client({
      method: 'PATCH',
      url: `${await this.ensureBaseUrl()}/v2/images/${imageId}`,
      data: operations,
      headers: {
        'X-Auth-Token': await keystoneClient.getToken(),
        'Content-Type': 'application/openstack-images-v2.1-json-patch'
      }
    });

    if (response.status >= 400) {
      throw new Error(`Failed to update image: ${response.status}`);
    }

    logger.info(`Image updated: ${imageId}`);
    return response.data;
  }

  async deleteImage(imageId: string): Promise<void> {
    await this.makeRequest('DELETE', `/v2/images/${imageId}`);
    logger.info(`Image deleted: ${imageId}`);
  }

  async uploadImageData(imageId: string, imageData: Buffer): Promise<void> {
    const baseUrl = await this.ensureBaseUrl();
    const token = await keystoneClient.getToken();

    const response = await this.client({
      method: 'PUT',
      url: `${baseUrl}/v2/images/${imageId}/file`,
      data: imageData,
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/octet-stream'
      }
    });

    if (response.status >= 400) {
      throw new Error(`Failed to upload image data: ${response.status}`);
    }

    logger.info(`Image data uploaded: ${imageId}`);
  }
}

export const glanceClient = new GlanceClient();
