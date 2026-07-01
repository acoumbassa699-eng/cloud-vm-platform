import { IInstanceRepository, Instance } from '../interfaces/repositories';
import { query } from '../database/connection';

export class InstanceRepository implements IInstanceRepository {
  async findById(id: string): Promise<Instance | null> {
    const result = await query('SELECT * FROM instances WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async findByOpenstackId(openstackId: string): Promise<Instance | null> {
    const result = await query('SELECT * FROM instances WHERE openstack_id = $1 AND deleted_at IS NULL', [openstackId]);
    return result.rows[0] || null;
  }

  async findByProjectId(projectId: string): Promise<Instance[]> {
    const result = await query(
      'SELECT * FROM instances WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [projectId]
    );
    return result.rows;
  }

  async create(instance: Partial<Instance>): Promise<Instance> {
    const result = await query(
      `INSERT INTO instances (id, user_id, project_id, openstack_id, name, status, vcpus, ram, disk, ip_address, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        instance.id, instance.user_id, instance.project_id, instance.openstack_id,
        instance.name, instance.status, instance.vcpus, instance.ram, instance.disk, instance.ip_address
      ]
    );
    return result.rows[0];
  }

  async update(id: string, instance: Partial<Instance>): Promise<void> {
    const fields = Object.keys(instance).filter(key => instance[key as keyof Instance] !== undefined);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => instance[field as keyof Instance]);

    await query(
      `UPDATE instances SET ${setClause}, updated_at = NOW() WHERE id = $1`,
      [id, ...values]
    );
  }

  async updateByOpenstackId(openstackId: string, instance: Partial<Instance>): Promise<void> {
    const fields = Object.keys(instance).filter(key => instance[key as keyof Instance] !== undefined);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => instance[field as keyof Instance]);

    await query(
      `UPDATE instances SET ${setClause}, updated_at = NOW() WHERE openstack_id = $1`,
      [openstackId, ...values]
    );
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE instances SET deleted_at = NOW() WHERE id = $1', [id]);
  }
}
