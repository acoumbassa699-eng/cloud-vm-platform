import { openstackClient } from './client';
import { logger } from '../../utils/logger';
import axios from 'axios';

export interface VMSpec {
  name: string;
  imageId: string;
  flavorId: string;
  networkId: string;
  securityGroups?: string[];
  keyName?: string;
  userData?: string;
  metadata?: Record<string, string>;
}

export interface VM {
  id: string;
  name: string;
  status: string;
  state: string;
  created: string;
  updated: string;
  addresses: Record<string, any[]>;
  flavor: { id: string; vcpus: number; ram: number; disk: number };
  image: { id: string };
  metadata: Record<string, string>;
  powerState: number;
  taskState: string | null;
}

export interface Flavor {
  id: string;
  name: string;
  vcpus: number;
  ram: number;
  disk: number;
  swap: number;
  ephemeral: number;
  rxtx_factor: number;
}

export class NovaService {
  private baseUrl: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.baseUrl = await openstackClient.getServiceUrl('compute');
      this.initialized = true;
      logger.info('Nova service initialized');
    } catch (error) {
      logger.error('Failed to initialize Nova service:', error);
      throw error;
    }
  }

  async createVM(spec: VMSpec): Promise<VM> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers`, {
        server: {
          name: spec.name,
          imageRef: spec.imageId,
          flavorRef: spec.flavorId,
          networks: [{ uuid: spec.networkId }],
          security_groups: spec.securityGroups || ['default'],
          key_name: spec.keyName,
          user_data: spec.userData ? Buffer.from(spec.userData).toString('base64') : undefined,
          metadata: spec.metadata
        }
      });

      if (response.status !== 202) {
        throw new Error(`Failed to create VM: ${response.status}`);
      }

      logger.info(`VM created: ${spec.name}`);
      return response.data.server;
    } catch (error) {
      logger.error('Failed to create VM:', error);
      throw error;
    }
  }

  async getVM(vmId: string): Promise<VM> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/servers/${vmId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get VM: ${response.status}`);
      }

      return response.data.server;
    } catch (error) {
      logger.error('Failed to get VM:', error);
      throw error;
    }
  }

  async listVMs(): Promise<VM[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/servers`, {
        params: { all_tenants: false }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to list VMs: ${response.status}`);
      }

      return response.data.servers;
    } catch (error) {
      logger.error('Failed to list VMs:', error);
      throw error;
    }
  }

  async deleteVM(vmId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().delete(`${this.baseUrl}/servers/${vmId}`);

      if (response.status !== 204) {
        throw new Error(`Failed to delete VM: ${response.status}`);
      }

      logger.info(`VM deleted: ${vmId}`);
    } catch (error) {
      logger.error('Failed to delete VM:', error);
      throw error;
    }
  }

  async rebootVM(vmId: string, rebootType: 'SOFT' | 'HARD' = 'SOFT'): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers/${vmId}/action`, {
        reboot: { type: rebootType }
      });

      if (response.status !== 202) {
        throw new Error(`Failed to reboot VM: ${response.status}`);
      }

      logger.info(`VM reboot initiated: ${vmId}`);
    } catch (error) {
      logger.error('Failed to reboot VM:', error);
      throw error;
    }
  }

  async startVM(vmId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers/${vmId}/action`, {
        os-start: null
      });

      if (response.status !== 202) {
        throw new Error(`Failed to start VM: ${response.status}`);
      }

      logger.info(`VM start initiated: ${vmId}`);
    } catch (error) {
      logger.error('Failed to start VM:', error);
      throw error;
    }
  }

  async stopVM(vmId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers/${vmId}/action`, {
        'os-stop': null
      });

      if (response.status !== 202) {
        throw new Error(`Failed to stop VM: ${response.status}`);
      }

      logger.info(`VM stop initiated: ${vmId}`);
    } catch (error) {
      logger.error('Failed to stop VM:', error);
      throw error;
    }
  }

  async getFlavors(): Promise<Flavor[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/flavors`);

      if (response.status !== 200) {
        throw new Error(`Failed to list flavors: ${response.status}`);
      }

      return response.data.flavors;
    } catch (error) {
      logger.error('Failed to list flavors:', error);
      throw error;
    }
  }

  async getFlavor(flavorId: string): Promise<Flavor> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/flavors/${flavorId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get flavor: ${response.status}`);
      }

      return response.data.flavor;
    } catch (error) {
      logger.error('Failed to get flavor:', error);
      throw error;
    }
  }
}

export const novaService = new NovaService();
