import { createInstanceJob } from '../../src/jobs/createInstance';
import { computeService } from '../../src/core/openstack/compute';
import { storageService } from '../../src/core/openstack/storage';
import { quotaService } from '../../src/core/openstack/quotas';
import { query } from '../../src/database/connection';

jest.mock('../../src/core/openstack/compute');
jest.mock('../../src/core/openstack/storage');
jest.mock('../../src/core/openstack/quotas');
jest.mock('../../src/database/connection');
jest.mock('../../src/services/redis');

describe('Provisioning Integration', () => {
  const jobData = {
    projectId: 'p1',
    instanceId: 'inst-1',
    name: 'test-vm',
    imageId: 'img-1',
    flavorId: 'f1',
    networkId: 'net-1',
    cpu: 1,
    ram: 1024,
    storage: 20
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully provision an instance', async () => {
    (quotaService.validateProvisioning as jest.Mock).mockResolvedValue({ valid: true });
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    (storageService.createVolume as jest.Mock).mockResolvedValue({ id: 'vol-1' });
    (storageService.getVolume as jest.Mock).mockResolvedValue({ status: 'available' });
    (computeService.createServer as jest.Mock).mockResolvedValue({ id: 'os-inst-1' });
    (computeService.getServer as jest.Mock).mockResolvedValue({ status: 'ACTIVE', addresses: { default: [{ addr: '10.0.0.1' }] } });

    const result = await createInstanceJob({ data: jobData } as any);

    expect(result.success).toBe(true);
    expect(result.ipAddress).toBe('10.0.0.1');
  });

  it('should rollback if server creation fails', async () => {
    (quotaService.validateProvisioning as jest.Mock).mockResolvedValue({ valid: true });
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    (storageService.createVolume as jest.Mock).mockResolvedValue({ id: 'vol-1' });
    (storageService.getVolume as jest.Mock).mockResolvedValue({ status: 'available' });
    (computeService.createServer as jest.Mock).mockRejectedValue(new Error('Nova Fail'));

    await expect(createInstanceJob({ data: jobData } as any)).rejects.toThrow('Nova Fail');

    expect(storageService.deleteVolume).toHaveBeenCalledWith('vol-1');
  }, 10000); // Higher timeout for rollback which has sleep
});
