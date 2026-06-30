import { openstackClient } from './client';
import { logger } from '../../utils/logger';

export interface Network {
  id: string;
  name: string;
  status: string;
  admin_state_up: boolean;
  mtu: number;
  provider_network_type: string;
  shared: boolean;
  project_id: string;
}

export interface Subnet {
  id: string;
  name: string;
  network_id: string;
  cidr: string;
  gateway_ip: string;
  dns_nameservers: string[];
  allocation_pools: Array<{ start: string; end: string }>;
  ip_version: number;
}

export interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  project_id: string;
  rules: SecurityGroupRule[];
}

export interface SecurityGroupRule {
  id: string;
  direction: 'ingress' | 'egress';
  ethertype: 'IPv4' | 'IPv6';
  protocol: string | null;
  port_range_min: number | null;
  port_range_max: number | null;
  remote_ip_prefix: string | null;
  security_group_id: string;
}

export class NeutronService {
  private baseUrl: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.baseUrl = await openstackClient.getServiceUrl('network');
      this.initialized = true;
      logger.info('Neutron service initialized');
    } catch (error) {
      logger.error('Failed to initialize Neutron service:', error);
      throw error;
    }
  }

  async listNetworks(): Promise<Network[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/networks`);

      if (response.status !== 200) {
        throw new Error(`Failed to list networks: ${response.status}`);
      }

      return response.data.networks;
    } catch (error) {
      logger.error('Failed to list networks:', error);
      throw error;
    }
  }

  async getNetwork(networkId: string): Promise<Network> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/networks/${networkId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get network: ${response.status}`);
      }

      return response.data.network;
    } catch (error) {
      logger.error('Failed to get network:', error);
      throw error;
    }
  }

  async createNetwork(name: string, adminStateUp: boolean = true): Promise<Network> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/networks`, {
        network: {
          name,
          admin_state_up: adminStateUp
        }
      });

      if (response.status !== 201) {
        throw new Error(`Failed to create network: ${response.status}`);
      }

      logger.info(`Network created: ${name}`);
      return response.data.network;
    } catch (error) {
      logger.error('Failed to create network:', error);
      throw error;
    }
  }

  async deleteNetwork(networkId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().delete(`${this.baseUrl}/networks/${networkId}`);

      if (response.status !== 204) {
        throw new Error(`Failed to delete network: ${response.status}`);
      }

      logger.info(`Network deleted: ${networkId}`);
    } catch (error) {
      logger.error('Failed to delete network:', error);
      throw error;
    }
  }

  async listSecurityGroups(): Promise<SecurityGroup[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/security-groups`);

      if (response.status !== 200) {
        throw new Error(`Failed to list security groups: ${response.status}`);
      }

      return response.data['security-groups'];
    } catch (error) {
      logger.error('Failed to list security groups:', error);
      throw error;
    }
  }

  async getSecurityGroup(sgId: string): Promise<SecurityGroup> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/security-groups/${sgId}`);

      if (response.status !== 200) {
        throw new Error(`Failed to get security group: ${response.status}`);
      }

      return response.data['security-group'];
    } catch (error) {
      logger.error('Failed to get security group:', error);
      throw error;
    }
  }

  async addSecurityGroupRule(
    sgId: string,
    direction: 'ingress' | 'egress',
    ethertype: 'IPv4' | 'IPv6',
    protocol: string | null,
    portMin?: number,
    portMax?: number,
    remoteIpPrefix?: string
  ): Promise<SecurityGroupRule> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();

    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/security-group-rules`, {
        'security-group-rule': {
          security_group_id: sgId,
          direction,
          ethertype,
          protocol,
          port_range_min: portMin,
          port_range_max: portMax,
          remote_ip_prefix: remoteIpPrefix
        }
      });

      if (response.status !== 201) {
        throw new Error(`Failed to add security group rule: ${response.status}`);
      }

      logger.info(`Security group rule added to ${sgId}`);
      return response.data['security-group-rule'];
    } catch (error) {
      logger.error('Failed to add security group rule:', error);
      throw error;
    }
  }
}

export const neutronService = new NeutronService();
