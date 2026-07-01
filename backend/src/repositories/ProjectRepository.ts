import { IProjectRepository, Project } from '../interfaces/repositories';
import { query } from '../database/connection';

export class ProjectRepository implements IProjectRepository {
  async findById(id: string): Promise<Project | null> {
    const result = await query('SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const result = await query(
      'SELECT * FROM projects WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async create(project: Partial<Project>): Promise<Project> {
    const result = await query(
      `INSERT INTO projects (id, user_id, name, description, quota_cpu, quota_ram, quota_storage, quota_instances, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        project.id, project.user_id, project.name, project.description,
        project.quota_cpu, project.quota_ram, project.quota_storage, project.quota_instances,
        project.status
      ]
    );
    return result.rows[0];
  }

  async update(id: string, project: Partial<Project>): Promise<void> {
    const fields = Object.keys(project).filter(key => project[key as keyof Project] !== undefined);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => project[field as keyof Project]);

    await query(
      `UPDATE projects SET ${setClause}, updated_at = NOW() WHERE id = $1`,
      [id, ...values]
    );
  }

  async delete(id: string): Promise<void> {
    await query('UPDATE projects SET deleted_at = NOW() WHERE id = $1', [id]);
  }
}
