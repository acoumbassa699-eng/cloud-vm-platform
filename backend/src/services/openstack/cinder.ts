import { openstackClient } from './client';
import { logger } from '../../utils/logger';

export interface Volume {
  id: string;
  name: string;
  size: number;
  status: string;
  volume_type: string;
  attachments: any[];
  metadata: Record<string, string>;
}

export interface Snapshot {
  id: string;
  name: string;
  volume_id: string;
  size: number;
  status: string;
}

export class CinderService {
  private baseUrl: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      this.baseUrl = await openstackClient.getServiceUrl('block-storage', 'public');
      this.initialized = true;
      logger.info('Cinder service initialized');
    } catch (error) {
      logger.error('Failed to initialize Cinder service:', error);
      throw error;
    }
  }

  async listVolumes(): Promise<Volume[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/volumes/detail`);
      return response.data.volumes;
    } catch (error) {
      logger.error('Failed to list volumes:', error);
      throw error;
    }
  }

  async getVolume(volumeId: string): Promise<Volume> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/volumes/${volumeId}`);
      return response.data.volume;
    } catch (error) {
      logger.error(`Failed to get volume ${volumeId}:`, error);
      throw error;
    }
  }

  async createVolume(name: string, size: number, volumeType?: string): Promise<Volume> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/volumes`, {
        volume: { name, size, volume_type: volumeType }
      });
      return response.data.volume;
    } catch (error) {
      logger.error('Failed to create volume:', error);
      throw error;
    }
  }

  async deleteVolume(volumeId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      await openstackClient.getClient().delete(`${this.baseUrl}/volumes/${volumeId}`);
    } catch (error) {
      logger.error(`Failed to delete volume ${volumeId}:`, error);
      throw error;
    }
  }

  async extendVolume(volumeId: string, newSize: number): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      await openstackClient.getClient().post(`${this.baseUrl}/volumes/${volumeId}/action`, {
        'os-extend': { new_size: newSize }
      });
    } catch (error) {
      logger.error(`Failed to extend volume ${volumeId}:`, error);
      throw error;
    }
  }

  async createSnapshot(volumeId: string, name: string): Promise<Snapshot> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/snapshots`, {
        snapshot: { volume_id: volumeId, name }
      });
      return response.data.snapshot;
    } catch (error) {
      logger.error(`Failed to create snapshot for volume ${volumeId}:`, error);
      throw error;
    }
  }

  async listSnapshots(): Promise<Snapshot[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/snapshots/detail`);
      return response.data.snapshots;
    } catch (error) {
      logger.error('Failed to list snapshots:', error);
      throw error;
    }
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      await openstackClient.getClient().delete(`${this.baseUrl}/snapshots/${snapshotId}`);
    } catch (error) {
      logger.error(`Failed to delete snapshot ${snapshotId}:`, error);
      throw error;
    }
  }
}

export const cinderService = new CinderService();
