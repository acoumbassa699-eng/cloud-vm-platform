import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Handle responses
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - clear token and redirect to login
          this.setToken(null);
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // Auth endpoints
  async register(email: string, password: string, name: string) {
    const response = await this.client.post('/auth/register', {
      email,
      password,
      name
    });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', {
      email,
      password
    });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  async logout() {
    this.setToken(null);
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', {
      refresh_token: refreshToken
    });
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  // Instance endpoints
  async listInstances() {
    const response = await this.client.get('/instances');
    return response.data.instances;
  }

  async getInstance(instanceId: string) {
    const response = await this.client.get(`/instances/${instanceId}`);
    return response.data;
  }

  async createInstance(
    name: string,
    imageId: string,
    flavorId: string,
    networkId: string,
    projectId: string,
    securityGroups?: string[]
  ) {
    const response = await this.client.post('/instances', {
      name,
      imageId,
      flavorId,
      networkId,
      projectId,
      securityGroups
    });
    return response.data;
  }

  async rebootInstance(instanceId: string, type: 'SOFT' | 'HARD' = 'SOFT') {
    const response = await this.client.post(`/instances/${instanceId}/reboot`, { type });
    return response.data;
  }

  async startInstance(instanceId: string) {
    const response = await this.client.post(`/instances/${instanceId}/start`, {});
    return response.data;
  }

  async stopInstance(instanceId: string) {
    const response = await this.client.post(`/instances/${instanceId}/stop`, {});
    return response.data;
  }

  async deleteInstance(instanceId: string) {
    const response = await this.client.delete(`/instances/${instanceId}`);
    return response.data;
  }

  async listFlavors() {
    const response = await this.client.get('/instances/flavors/list');
    return response.data.flavors;
  }

  // Storage endpoints
  async listVolumes() {
    const response = await this.client.get('/storage/volumes');
    return response.data.volumes;
  }

  async createVolume(name: string, size: number, projectId: string, volumeType?: string) {
    const response = await this.client.post('/storage/volumes', {
      name,
      size,
      projectId,
      volumeType
    });
    return response.data;
  }

  async listSnapshots() {
    const response = await this.client.get('/storage/snapshots');
    return response.data.snapshots;
  }

  async createSnapshot(name: string, volumeId: string, projectId: string) {
    const response = await this.client.post('/storage/snapshots', {
      name,
      volumeId,
      projectId
    });
    return response.data;
  }

  async deleteSnapshot(snapshotId: string) {
    const response = await this.client.delete(`/storage/snapshots/${snapshotId}`);
    return response.data;
  }

  // Networking endpoints
  async listNetworks() {
    const response = await this.client.get('/networks');
    return response.data.networks;
  }

  async createNetwork(name: string, projectId: string) {
    const response = await this.client.post('/networks', { name, projectId });
    return response.data;
  }

  async listSecurityGroups() {
    const response = await this.client.get('/networks/security-groups');
    return response.data.security_groups;
  }

  // Images endpoints
  async listImages(name?: string, status?: string) {
    const response = await this.client.get('/images', {
      params: { name, status }
    });
    return response.data.images;
  }

  async getImage(imageId: string) {
    const response = await this.client.get(`/images/${imageId}`);
    return response.data.image;
  }

  // Monitoring endpoints
  async getMetrics(instanceId?: string, metric?: string, start?: string, end?: string) {
    const response = await this.client.get('/monitoring/metrics', {
      params: { instanceId, metric, start, end }
    });
    return response.data.metrics;
  }

  async listAlerts(projectId?: string) {
    const response = await this.client.get('/monitoring/alerts', {
      params: { projectId }
    });
    return response.data.alerts;
  }

  async resolveAlert(alertId: string, resolved: boolean) {
    const response = await this.client.put(`/monitoring/alerts/${alertId}`, { resolved });
    return response.data;
  }

  async getInstanceHealth(instanceId: string) {
    const response = await this.client.get(`/monitoring/instance/${instanceId}/health`);
    return response.data;
  }

  // Billing endpoints
  async getBillingUsage(projectId?: string) {
    const response = await this.client.get('/billing/usage', {
      params: { projectId }
    });
    return response.data;
  }

  async listInvoices(month?: number, year?: number) {
    const response = await this.client.get('/billing/invoices', {
      params: { month, year }
    });
    return response.data.invoices;
  }

  async getInvoice(invoiceId: string) {
    const response = await this.client.get(`/billing/invoices/${invoiceId}`);
    return response.data;
  }

  async getCostAnalysis(projectId?: string) {
    const response = await this.client.get('/billing/cost-analysis', {
      params: { projectId }
    });
    return response.data.daily_costs;
  }

  // Projects endpoints
  async listProjects() {
    const response = await this.client.get('/projects');
    return response.data.projects;
  }

  async getProject(projectId: string) {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  async createProject(name: string, description?: string) {
    const response = await this.client.post('/projects', { name, description });
    return response.data;
  }

  async updateProject(projectId: string, name?: string, description?: string) {
    const response = await this.client.put(`/projects/${projectId}`, { name, description });
    return response.data;
  }

  async deleteProject(projectId: string) {
    const response = await this.client.delete(`/projects/${projectId}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
