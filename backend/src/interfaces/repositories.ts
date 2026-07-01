export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  quota_cpu: number;
  quota_ram: number;
  quota_storage: number;
  quota_instances: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Instance {
  id: string;
  user_id: string;
  project_id: string;
  openstack_id: string;
  name: string;
  status: string;
  vcpus: number;
  ram: number;
  disk: number;
  ip_address?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Partial<User>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<void>;
}

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByUserId(userId: string): Promise<Project[]>;
  create(project: Partial<Project>): Promise<Project>;
  update(id: string, project: Partial<Project>): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IInstanceRepository {
  findById(id: string): Promise<Instance | null>;
  findByOpenstackId(openstackId: string): Promise<Instance | null>;
  findByProjectId(projectId: string): Promise<Instance[]>;
  create(instance: Partial<Instance>): Promise<Instance>;
  update(id: string, instance: Partial<Instance>): Promise<void>;
  updateByOpenstackId(openstackId: string, instance: Partial<Instance>): Promise<void>;
  delete(id: string): Promise<void>;
}
