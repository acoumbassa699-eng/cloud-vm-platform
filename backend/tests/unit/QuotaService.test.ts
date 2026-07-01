import { QuotaService } from '../../src/services/quota';
import { container } from '../../src/container';

jest.mock('../../src/container');

describe('QuotaService', () => {
  let quotaService: QuotaService;
  let mockProjectRepo: any;
  let mockInstanceRepo: any;

  beforeEach(() => {
    mockProjectRepo = {
      findById: jest.fn()
    };
    mockInstanceRepo = {
      findByProjectId: jest.fn()
    };

    (container.getRepository as jest.Mock).mockImplementation((name) => {
      if (name === 'ProjectRepository') return mockProjectRepo;
      if (name === 'InstanceRepository') return mockInstanceRepo;
    });

    quotaService = new QuotaService();
  });

  it('should allow if quota is not exceeded', async () => {
    mockProjectRepo.findById.mockResolvedValue({
      quota_instances: 10,
      quota_cpu: 20,
      quota_ram: 4096,
      quota_storage: 100
    });
    mockInstanceRepo.findByProjectId.mockResolvedValue([]);

    const result = await quotaService.checkQuota('p1', {
      instances: 1,
      cpu: 2,
      ram: 1024,
      disk: 20
    });

    expect(result.allowed).toBe(true);
  });

  it('should deny if instance quota is exceeded', async () => {
    mockProjectRepo.findById.mockResolvedValue({
      quota_instances: 1,
      quota_cpu: 20,
      quota_ram: 4096,
      quota_storage: 100
    });
    mockInstanceRepo.findByProjectId.mockResolvedValue([{ vcpus: 1, ram: 1024, disk: 10 }]);

    const result = await quotaService.checkQuota('p1', {
      instances: 1,
      cpu: 1,
      ram: 1024,
      disk: 10
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Instance quota exceeded');
  });
});
