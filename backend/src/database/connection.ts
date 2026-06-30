import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool;

export async function initializeDatabase(): Promise<void> {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
    min: parseInt(process.env.DATABASE_POOL_MIN || '2')
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    await runMigrations();
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult> {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  const migrations = [
    createUsersTable,
    createProjectsTable,
    createInstancesTable,
    createSnapshotsTable,
    createBillingTable,
    createAuditLogsTable,
    createNetworksTable,
    createVolumesTable,
    createSecurityGroupsTable
  ];

  for (const migration of migrations) {
    try {
      await migration();
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }
}

async function createUsersTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_status (status)
    )
  `);
}

async function createProjectsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      quota_cpu INT DEFAULT 10,
      quota_ram INT DEFAULT 50,
      quota_storage INT DEFAULT 500,
      quota_instances INT DEFAULT 20,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_user_id (user_id)
    )
  `);
}

async function createInstancesTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS instances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      state VARCHAR(50) DEFAULT 'CREATING',
      cpu INT NOT NULL,
      ram INT NOT NULL,
      storage INT NOT NULL,
      image_id VARCHAR(255),
      image_name VARCHAR(255),
      network_id VARCHAR(255),
      ip_address INET,
      keypair_name VARCHAR(255),
      security_group_ids TEXT[],
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP,
      INDEX idx_project_id (project_id),
      INDEX idx_state (state),
      INDEX idx_provider_id (provider_id)
    )
  `);
}

async function createSnapshotsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      provider_snapshot_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      size INT,
      state VARCHAR(50) DEFAULT 'creating',
      created_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_instance_id (instance_id)
    )
  `);
}

async function createBillingTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS billing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      cpu_hours DECIMAL(10, 2),
      ram_hours DECIMAL(10, 2),
      storage_hours DECIMAL(10, 2),
      subtotal DECIMAL(12, 2),
      tax DECIMAL(12, 2),
      total DECIMAL(12, 2),
      status VARCHAR(50) DEFAULT 'pending',
      due_date DATE,
      paid_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_project_id (project_id),
      INDEX idx_status (status)
    )
  `);
}

async function createAuditLogsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      action VARCHAR(255) NOT NULL,
      resource_type VARCHAR(255),
      resource_id VARCHAR(255),
      details JSONB,
      ip_address INET,
      created_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_user_id (user_id),
      INDEX idx_action (action),
      INDEX idx_created_at (created_at)
    )
  `);
}

async function createNetworksTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS networks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      cidr VARCHAR(50),
      gateway INET,
      dns_servers TEXT[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_project_id (project_id)
    )
  `);
}

async function createVolumesTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS volumes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      instance_id UUID REFERENCES instances(id) ON DELETE SET NULL,
      provider_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      size INT NOT NULL,
      state VARCHAR(50) DEFAULT 'creating',
      volume_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_project_id (project_id),
      INDEX idx_instance_id (instance_id)
    )
  `);
}

async function createSecurityGroupsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS security_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      rules JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      INDEX idx_project_id (project_id)
    )
  `);
}
