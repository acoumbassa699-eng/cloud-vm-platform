import { openstackClient } from './client';
import { logger } from '../../utils/logger';

export interface Volume {
  id: string;
  name: string;
  status: string;
  size: number;
  volume_type: string;
  created_at: string;
  updated_at: string;
  attachments: Array<{ id: string; server_id: string; device: string }>;
  metadata: Record<string, string>;
}

export interface VolumeType {
  id: string;
  name: string;
  extra_specs: Record<string, string>;
}

export interface Snapshot {
  id: string;
  name: string;
  status: string;
  size: number;
  volume_id: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, string>;
}

export class CinderService {
  private baseUrl: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.baseUrl = await openstackClient.getServiceUrl('volumev3');
      this.initialized = true;
      logger.info('Cinder service initialized');
    } catch (error) {
      logger.error('Failed to initialize Cinder service:', error);
      throw error;
    }
  }

  async createVolume(name: string, size: number, volumeType?: string): Promise<Volume> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/volumes`, {
        volume: {
          name,
          size,
          volume_type: volumeType
        }
      });

      if (response.status !== 202) {
        throw new Error(`Failed to create volume: ${response.status}`);
      }

      logger.info(`Volume created: ${name}`);
      return response.data.volume;
    } catch (error) {
      logger.error('Failed to create volume:', error);
      throw error;
    }
  }

  async getVolume(volumeId: string): Promise<Volume> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/volumes/${volumeId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get volume: ${response.status}`);
      }

      return response.data.volume;
    } catch (error) {
      logger.error('Failed to get volume:', error);
      throw error;
    }
  }

  async listVolumes(): Promise<Volume[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/volumes`);

      if (response.status !== 200) {
        throw new Error(`Failed to list volumes: ${response.status}`);
      }

      return response.data.volumes;
    } catch (error) {
      logger.error('Failed to list volumes:', error);
      throw error;
    }
  }

  async deleteVolume(volumeId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().delete(`${this.baseUrl}/volumes/${volumeId}`);

      if (response.status !== 204) {
        throw new Error(`Failed to delete volume: ${response.status}`);
      }

      logger.info(`Volume deleted: ${volumeId}`);
    } catch (error) {
      logger.error('Failed to delete volume:', error);
      throw error;
    }
  }

  async createSnapshot(volumeId: string, name: string): Promise<Snapshot> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/snapshots`, {
        snapshot: {
          name,
          volume_id: volumeId
        }
      });

      if (response.status !== 202) {
        throw new Error(`Failed to create snapshot: ${response.status}`);
      }

      logger.info(`Snapshot created: ${name}`);
      return response.data.snapshot;
    } catch (error) {
      logger.error('Failed to create snapshot:', error);
      throw error;
    }
  }

  async getSnapshot(snapshotId: string): Promise<Snapshot> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/snapshots/${snapshotId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get snapshot: ${response.status}`);
      }

      return response.data.snapshot;
    } catch (error) {
      logger.error('Failed to get snapshot:', error);
      throw error;
    }
  }

  async listSnapshots(): Promise<Snapshot[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/snapshots`);

      if (response.status !== 200) {
        throw new Error(`Failed to list snapshots: ${response.status}`);
      }

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
      const response = await openstackClient.getClient().delete(`${this.baseUrl}/snapshots/${snapshotId}`);

      if (response.status !== 204) {
        throw new Error(`Failed to delete snapshot: ${response.status}`);
      }

      logger.info(`Snapshot deleted: ${snapshotId}`);
    } catch (error) {
      logger.error('Failed to delete snapshot:', error);
      throw error;
    }
  }
}

export const cinderService = new CinderService();
