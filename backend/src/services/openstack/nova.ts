import { openstackClient } from './client';
import { logger } from '../../utils/logger';

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
          security_groups: spec.securityGroups?.map(sg => ({ name: sg })) || [{ name: 'default' }],
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
      const response = await openstackClient.getClient().get(`${this.baseUrl}/servers/detail`, {
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

  private async vmAction(vmId: string, action: string, body: any = null): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers/${vmId}/action`, {
        [action]: body
      });

      if (response.status !== 202) {
        throw new Error(`Failed to perform ${action} on VM ${vmId}: ${response.status}`);
      }

      logger.info(`VM ${action} initiated: ${vmId}`);
    } catch (error) {
      logger.error(`Failed to perform ${action} on VM ${vmId}:`, error);
      throw error;
    }
  }

  async rebootVM(vmId: string, rebootType: 'SOFT' | 'HARD' = 'SOFT'): Promise<void> {
    await this.vmAction(vmId, 'reboot', { type: rebootType });
  }

  async startVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'os-start');
  }

  async stopVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'os-stop');
  }

  async pauseVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'pause');
  }

  async unpauseVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'unpause');
  }

  async suspendVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'suspend');
  }

  async resumeVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'resume');
  }

  async resizeVM(vmId: string, flavorId: string): Promise<void> {
    await this.vmAction(vmId, 'resize', { flavorRef: flavorId });
  }

  async confirmResizeVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'confirmResize');
  }

  async revertResizeVM(vmId: string): Promise<void> {
    await this.vmAction(vmId, 'revertResize');
  }

  async getConsoleOutput(vmId: string, length?: number): Promise<string> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers/${vmId}/action`, {
        'os-getConsoleOutput': { length }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to get console output for VM ${vmId}: ${response.status}`);
      }

      return response.data.output;
    } catch (error) {
      logger.error(`Failed to get console output for VM ${vmId}:`, error);
      throw error;
    }
  }

  async getVNCConsole(vmId: string): Promise<{ url: string; type: string }> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/servers/${vmId}/action`, {
        'os-getVNCConsole': { type: 'novnc' }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to get VNC console for VM ${vmId}: ${response.status}`);
      }

      return response.data.console;
    } catch (error) {
      logger.error(`Failed to get VNC console for VM ${vmId}:`, error);
      throw error;
    }
  }

  async getFlavors(): Promise<Flavor[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/flavors/detail`);

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
