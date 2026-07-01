import { UserRepository } from '../repositories/UserRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { InstanceRepository } from '../repositories/InstanceRepository';

class Container {
  private repositories: Map<string, any> = new Map();

  constructor() {
    this.repositories.set('UserRepository', new UserRepository());
    this.repositories.set('ProjectRepository', new ProjectRepository());
    this.repositories.set('InstanceRepository', new InstanceRepository());
  }

  getRepository<T>(name: string): T {
    const repository = this.repositories.get(name);
    if (!repository) {
      throw new Error(`Repository ${name} not found in container`);
    }
    return repository;
  }
}

export const container = new Container();
