import { query } from '../database/connection';

export interface InstanceDTO {
  id: string;
  user_id: string;
  project_id: string;
  provider_id?: string;
  name: string;
  state: string;
  vcpus: number;
  ram: number;
  disk: number;
  ip_address?: string;
  created_at: Date;
  updated_at: Date;
}

export class InstanceRepository {
  async findById(id: string): Promise<InstanceDTO | null> {
    const res = await query('SELECT * FROM instances WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<InstanceDTO[]> {
    const res = await query('SELECT * FROM instances WHERE user_id = $1 AND state != $2', [userId, 'DELETED']);
    return res.rows;
  }

  async create(data: Partial<InstanceDTO>): Promise<InstanceDTO> {
    const res = await query(
      `INSERT INTO instances (id, user_id, project_id, name, state, vcpus, ram, disk, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [data.id, data.user_id, data.project_id, data.name, data.state, data.vcpus, data.ram, data.disk]
    );
    return res.rows[0];
  }

  async update(id: string, data: Partial<InstanceDTO>): Promise<void> {
    const keys = Object.keys(data).filter(k => (data as any)[k] !== undefined);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map(k => (data as any)[k]);
    await query(`UPDATE instances SET ${setClause}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE instances SET state = $1, deleted_at = NOW() WHERE id = $2', ['DELETED', id]);
  }
}
export const instanceRepository = new InstanceRepository();
