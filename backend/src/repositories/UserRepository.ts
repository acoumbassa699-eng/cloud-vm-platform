import { IUserRepository, User } from '../interfaces/repositories';
import { query } from '../database/connection';

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  async create(user: Partial<User>): Promise<User> {
    const result = await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [user.id, user.email, user.password_hash, user.first_name, user.last_name, user.role, user.status]
    );
    return result.rows[0];
  }

  async update(id: string, user: Partial<User>): Promise<void> {
    const fields = Object.keys(user).filter(key => user[key as keyof User] !== undefined);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => user[field as keyof User]);

    await query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1`,
      [id, ...values]
    );
  }
}
