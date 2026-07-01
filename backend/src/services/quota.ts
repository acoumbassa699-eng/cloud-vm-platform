import { IProjectRepository, IInstanceRepository } from '../interfaces/repositories';
import { container } from '../container';
import { logger } from '../utils/logger';

export class QuotaService {
  private projectRepository: IProjectRepository;
  private instanceRepository: IInstanceRepository;

  constructor() {
    this.projectRepository = container.getRepository<IProjectRepository>('ProjectRepository');
    this.instanceRepository = container.getRepository<IInstanceRepository>('InstanceRepository');
  }

  async checkQuota(projectId: string, requested: { cpu: number; ram: number; disk: number; instances: number }): Promise<{ allowed: boolean; reason?: string }> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const instances = await this.instanceRepository.findByProjectId(projectId);

    const usage = instances.reduce(
      (acc, inst) => {
        acc.cpu += inst.vcpus;
        acc.ram += inst.ram;
        acc.disk += inst.disk;
        acc.instances += 1;
        return acc;
      },
      { cpu: 0, ram: 0, disk: 0, instances: 0 }
    );

    if (usage.instances + requested.instances > project.quota_instances) {
      return { allowed: false, reason: 'Instance quota exceeded' };
    }
    if (usage.cpu + requested.cpu > project.quota_cpu) {
      return { allowed: false, reason: 'CPU quota exceeded' };
    }
    if (usage.ram + requested.ram > project.quota_ram) {
      return { allowed: false, reason: 'RAM quota exceeded' };
    }
    if (usage.disk + requested.disk > project.quota_storage) {
      return { allowed: false, reason: 'Storage quota exceeded' };
    }

    return { allowed: true };
  }

  async getUsage(projectId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const instances = await this.instanceRepository.findByProjectId(projectId);

    const usage = instances.reduce(
      (acc, inst) => {
        acc.cpu += inst.vcpus;
        acc.ram += inst.ram;
        acc.disk += inst.disk;
        acc.instances += 1;
        return acc;
      },
      { cpu: 0, ram: 0, disk: 0, instances: 0 }
    );

    return {
      quota: {
        cpu: project.quota_cpu,
        ram: project.quota_ram,
        disk: project.quota_storage,
        instances: project.quota_instances
      },
      usage
    };
  }
}

export const quotaService = new QuotaService();
