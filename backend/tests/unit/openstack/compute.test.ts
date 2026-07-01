import axios from 'axios';
import { ComputeService } from '../../../src/core/openstack/compute';

jest.mock('axios', () => {
  return {
    create: jest.fn().mockReturnThis(),
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } }
  };
});

describe('ComputeService', () => {
  let computeService: ComputeService;
  let mockAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = {
      getServiceUrl: jest.fn().mockResolvedValue('http://nova:8774/v2.1'),
      getToken: jest.fn().mockResolvedValue('test-token'),
    };
    computeService = new ComputeService(mockAuth);
  });

  it('should list servers', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { servers: [{ id: '1', name: 'vm1' }] } });
    const servers = await computeService.listServers();
    expect(servers).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledWith('/servers/detail');
  });

  it('should create a server', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { server: { id: 'new-id' } } });
    const server = await computeService.createServer({ name: 'test-vm' });
    expect(server.id).toBe('new-id');
    expect(axios.post).toHaveBeenCalledWith('/servers', { server: { name: 'test-vm' } });
  });
});
