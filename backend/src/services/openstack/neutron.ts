import { openstackClient } from './client';
import { logger } from '../../utils/logger';

export interface Network {
  id: string;
  name: string;
  status: string;
  subnets: string[];
  'router:external'?: boolean;
}

export interface Subnet {
  id: string;
  name: string;
  network_id: string;
  cidr: string;
  gateway_ip: string;
  dns_nameservers: string[];
}

export interface Router {
  id: string;
  name: string;
  status: string;
  external_gateway_info?: any;
}

export interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  security_group_rules: SecurityGroupRule[];
}

export interface SecurityGroupRule {
  id: string;
  direction: 'ingress' | 'egress';
  ethertype: 'IPv4' | 'IPv6';
  protocol?: string;
  port_range_min?: number;
  port_range_max?: number;
  remote_ip_prefix?: string;
  remote_group_id?: string;
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
      const response = await openstackClient.getClient().get(`${this.baseUrl}/v2.0/networks`);
      return response.data.networks;
    } catch (error) {
      logger.error('Failed to list networks:', error);
      throw error;
    }
  }

  async createNetwork(name: string): Promise<Network> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/v2.0/networks`, {
        network: { name }
      });
      return response.data.network;
    } catch (error) {
      logger.error('Failed to create network:', error);
      throw error;
    }
  }

  async createSubnet(networkId: string, cidr: string, name: string): Promise<Subnet> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/v2.0/subnets`, {
        subnet: {
          network_id: networkId,
          cidr,
          name,
          ip_version: 4
        }
      });
      return response.data.subnet;
    } catch (error) {
      logger.error('Failed to create subnet:', error);
      throw error;
    }
  }

  async createRouter(name: string, externalNetworkId?: string): Promise<Router> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const body: any = { name };
      if (externalNetworkId) {
        body.external_gateway_info = { network_id: externalNetworkId };
      }
      const response = await openstackClient.getClient().post(`${this.baseUrl}/v2.0/routers`, {
        router: body
      });
      return response.data.router;
    } catch (error) {
      logger.error('Failed to create router:', error);
      throw error;
    }
  }

  async addRouterInterface(routerId: string, subnetId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      await openstackClient.getClient().put(`${this.baseUrl}/v2.0/routers/${routerId}/add_router_interface`, {
        subnet_id: subnetId
      });
    } catch (error) {
      logger.error('Failed to add router interface:', error);
      throw error;
    }
  }

  async listSecurityGroups(): Promise<SecurityGroup[]> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().get(`${this.baseUrl}/v2.0/security-groups`);
      return response.data.security_groups;
    } catch (error) {
      logger.error('Failed to list security groups:', error);
      throw error;
    }
  }

  async createSecurityGroup(name: string, description?: string): Promise<SecurityGroup> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/v2.0/security-groups`, {
        security_group: { name, description }
      });
      return response.data.security_group;
    } catch (error) {
      logger.error('Failed to create security group:', error);
      throw error;
    }
  }

  async createSecurityGroupRule(rule: Partial<SecurityGroupRule> & { security_group_id: string }): Promise<SecurityGroupRule> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/v2.0/security-group-rules`, {
        security_group_rule: rule
      });
      return response.data.security_group_rule;
    } catch (error) {
      logger.error('Failed to create security group rule:', error);
      throw error;
    }
  }

  async allocateFloatingIP(floatingNetworkId: string): Promise<any> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      const response = await openstackClient.getClient().post(`${this.baseUrl}/v2.0/floatingips`, {
        floatingip: { floating_network_id: floatingNetworkId }
      });
      return response.data.floatingip;
    } catch (error) {
      logger.error('Failed to allocate floating IP:', error);
      throw error;
    }
  }

  async associateFloatingIP(floatingIpId: string, portId: string): Promise<void> {
    await this.initialize();
    await openstackClient.ensureAuthenticated();
    try {
      await openstackClient.getClient().put(`${this.baseUrl}/v2.0/floatingips/${floatingIpId}`, {
        floatingip: { port_id: portId }
      });
    } catch (error) {
      logger.error('Failed to associate floating IP:', error);
      throw error;
    }
  }
}

export const neutronService = new NeutronService();
