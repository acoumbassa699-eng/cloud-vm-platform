import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { keystoneClient } from './keystone';
import { getCache, setCache } from './redis';

class NeutronClient {
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
    this.baseUrl = await keystoneClient.getServiceEndpoint('network');
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
        throw new Error(`Neutron API error: ${response.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Neutron API request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  async createNetwork(networkData: {
    name: string;
    cidr: string;
    adminStateUp?: boolean;
  }): Promise<any> {
    const payload = {
      network: {
        name: networkData.name,
        admin_state_up: networkData.adminStateUp !== false,
        'provider:network_type': 'flat',
        'provider:physical_network': 'physnet1'
      }
    };

    const response = await this.makeRequest('POST', '/v2.0/networks', payload);
    logger.info(`Network created: ${response.network.id}`);
    return response.network;
  }

  async getNetwork(networkId: string): Promise<any> {
    const cacheKey = `neutron:network:${networkId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.makeRequest('GET', `/v2.0/networks/${networkId}`);
    await setCache(cacheKey, response.network, 300);
    return response.network;
  }

  async listNetworks(projectId?: string): Promise<any[]> {
    let path = '/v2.0/networks';
    if (projectId) {
      path += `?project_id=${projectId}`;
    }

    const response = await this.makeRequest('GET', path);
    return response.networks;
  }

  async deleteNetwork(networkId: string): Promise<void> {
    await this.makeRequest('DELETE', `/v2.0/networks/${networkId}`);
    logger.info(`Network deleted: ${networkId}`);
  }

  async createSubnet(subnetData: {
    networkId: string;
    name: string;
    cidr: string;
    gateway?: string;
    dns?: string[];
  }): Promise<any> {
    const payload = {
      subnet: {
        network_id: subnetData.networkId,
        name: subnetData.name,
        cidr: subnetData.cidr,
        gateway_ip: subnetData.gateway,
        dns_nameservers: subnetData.dns || [],
        ip_version: 4
      }
    };

    const response = await this.makeRequest('POST', '/v2.0/subnets', payload);
    logger.info(`Subnet created: ${response.subnet.id}`);
    return response.subnet;
  }

  async createSecurityGroup(securityGroupData: {
    name: string;
    description?: string;
  }): Promise<any> {
    const payload = {
      security_group: {
        name: securityGroupData.name,
        description: securityGroupData.description || ''
      }
    };

    const response = await this.makeRequest('POST', '/v2.0/security-groups', payload);
    logger.info(`Security group created: ${response.security_group.id}`);
    return response.security_group;
  }

  async addSecurityGroupRule(ruleData: {
    securityGroupId: string;
    direction: 'ingress' | 'egress';
    protocol: string;
    portRangeMin?: number;
    portRangeMax?: number;
    cidr?: string;
    remoteGroupId?: string;
  }): Promise<any> {
    const payload = {
      security_group_rule: {
        security_group_id: ruleData.securityGroupId,
        direction: ruleData.direction,
        protocol: ruleData.protocol,
        port_range_min: ruleData.portRangeMin,
        port_range_max: ruleData.portRangeMax,
        remote_ip_prefix: ruleData.cidr,
        remote_group_id: ruleData.remoteGroupId
      }
    };

    const response = await this.makeRequest('POST', '/v2.0/security-group-rules', payload);
    logger.info(`Security group rule created: ${response.security_group_rule.id}`);
    return response.security_group_rule;
  }

  async allocateFloatingIP(floatingNetworkId: string): Promise<any> {
    const payload = {
      floatingip: {
        floating_network_id: floatingNetworkId
      }
    };

    const response = await this.makeRequest('POST', '/v2.0/floatingips', payload);
    logger.info(`Floating IP allocated: ${response.floatingip.floating_ip_address}`);
    return response.floatingip;
  }

  async associateFloatingIP(floatingIPId: string, portId: string, fixedIP?: string): Promise<any> {
    const payload = {
      floatingip: {
        port_id: portId,
        fixed_ip_address: fixedIP
      }
    };

    const response = await this.makeRequest('PUT', `/v2.0/floatingips/${floatingIPId}`, payload);
    logger.info(`Floating IP associated: ${floatingIPId}`);
    return response.floatingip;
  }

  async listPorts(projectId?: string): Promise<any[]> {
    let path = '/v2.0/ports';
    if (projectId) {
      path += `?project_id=${projectId}`;
    }

    const response = await this.makeRequest('GET', path);
    return response.ports;
  }
}

export const neutronClient = new NeutronClient();
