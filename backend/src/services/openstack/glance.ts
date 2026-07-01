import { openstackClient } from './client';
import { logger } from '../../utils/logger';

export interface Image {
  id: string;
  name: string;
  status: string;
  container_format: string;
  disk_format: string;
  size: number;
  visibility: string;
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
      const response = await openstackClient.getClient().get(`${this.baseUrl}/v2/images`);
      return response.data.images;
    } catch (error) {
      logger.error('Failed to list images:', error);
      throw error;
    }
  }

  async searchImages(name?: string, status?: string): Promise<Image[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const params: any = {};
      if (name) params.name = name;
      if (status) params.status = status;

      const response = await openstackClient.getClient().get(`${this.baseUrl}/v2/images`, { params });
      return response.data.images;
    } catch (error) {
      logger.error('Failed to search images:', error);
      throw error;
    }
  }

  async getImage(imageId: string): Promise<Image> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/v2/images/${imageId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get image ${imageId}:`, error);
      throw error;
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      await openstackClient.getClient().delete(`${this.baseUrl}/v2/images/${imageId}`);
    } catch (error) {
      logger.error(`Failed to delete image ${imageId}:`, error);
      throw error;
    }
  }

  async updateImage(imageId: string, patches: { op: string; path: string; value: any }[]): Promise<Image> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().patch(`${this.baseUrl}/v2/images/${imageId}`, patches, {
        headers: { 'Content-Type': 'application/openstack-images-v2.1-json-patch' }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to update image ${imageId}:`, error);
      throw error;
    }
  }
}

export const glanceService = new GlanceService();
