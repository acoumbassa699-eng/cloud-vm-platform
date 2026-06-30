import { openstackClient } from './client';
import { logger } from '../../utils/logger';

export interface Image {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  size: number;
  disk_format: string;
  container_format: string;
  visibility: string;
  os_distro?: string;
  os_version?: string;
  min_disk: number;
  min_ram: number;
  properties: Record<string, any>;
}

export class GlanceService {
  private baseUrl: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.baseUrl = await openstackClient.getServiceUrl('image');
      this.initialized = true;
      logger.info('Glance service initialized');
    } catch (error) {
      logger.error('Failed to initialize Glance service:', error);
      throw error;
    }
  }

  async listImages(): Promise<Image[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/images`);

      if (response.status !== 200) {
        throw new Error(`Failed to list images: ${response.status}`);
      }

      return response.data.images;
    } catch (error) {
      logger.error('Failed to list images:', error);
      throw error;
    }
  }

  async getImage(imageId: string): Promise<Image> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/images/${imageId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get image: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get image:', error);
      throw error;
    }
  }

  async searchImages(name?: string, status?: string): Promise<Image[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const params: Record<string, any> = {};
      if (name) params.name = name;
      if (status) params.status = status;

      const response = await openstackClient.getClient().get(`${this.baseUrl}/images`, { params });

      if (response.status !== 200) {
        throw new Error(`Failed to search images: ${response.status}`);
      }

      return response.data.images;
    } catch (error) {
      logger.error('Failed to search images:', error);
      throw error;
    }
  }
}

export const glanceService = new GlanceService();
