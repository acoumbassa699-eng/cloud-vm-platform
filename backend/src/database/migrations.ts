import { Pool } from 'pg';
import { logger } from '../utils/logger';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  {
    id: '001_initial_schema',
    up: `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_users_email ON users(email);

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_projects_user_id ON projects(user_id);

      -- Instances table
      CREATE TABLE IF NOT EXISTS instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        openstack_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        vcpus INTEGER NOT NULL,
        ram INTEGER NOT NULL,
        disk INTEGER NOT NULL,
        ip_address VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_instances_user_id ON instances(user_id);
      CREATE INDEX idx_instances_project_id ON instances(project_id);
      CREATE INDEX idx_instances_openstack_id ON instances(openstack_id);

      -- Volumes table
      CREATE TABLE IF NOT EXISTS volumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        openstack_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        size INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'CREATING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_volumes_user_id ON volumes(user_id);
      CREATE INDEX idx_volumes_project_id ON volumes(project_id);

      -- Snapshots table
      CREATE TABLE IF NOT EXISTS snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        openstack_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        size INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'CREATING',
        volume_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_snapshots_user_id ON snapshots(user_id);
      CREATE INDEX idx_snapshots_project_id ON snapshots(project_id);
      CREATE INDEX idx_snapshots_volume_id ON snapshots(volume_id);

      -- Networks table
      CREATE TABLE IF NOT EXISTS networks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        openstack_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        cidr VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'CREATING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_networks_user_id ON networks(user_id);
      CREATE INDEX idx_networks_project_id ON networks(project_id);

      -- Security Groups table
      CREATE TABLE IF NOT EXISTS security_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID NOT NULL REFERENCES projects(id),
        openstack_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX idx_security_groups_user_id ON security_groups(user_id);
      CREATE INDEX idx_security_groups_project_id ON security_groups(project_id);

      -- Alerts table
      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        project_id UUID REFERENCES projects(id),
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        resource_id VARCHAR(255),
        resource_type VARCHAR(50),
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      CREATE INDEX idx_alerts_user_id ON alerts(user_id);
      CREATE INDEX idx_alerts_project_id ON alerts(project_id);
      CREATE INDEX idx_alerts_resolved ON alerts(resolved);

      -- Invoices table
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        billing_month DATE NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_invoices_user_id ON invoices(user_id);
      CREATE INDEX idx_invoices_billing_month ON invoices(billing_month);

      -- Invoice Items table
      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description VARCHAR(255) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

      -- Audit Log table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(255),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
    `,
    down: `
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS invoice_items CASCADE;
      DROP TABLE IF EXISTS invoices CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS security_groups CASCADE;
      DROP TABLE IF EXISTS networks CASCADE;
      DROP TABLE IF EXISTS snapshots CASCADE;
      DROP TABLE IF EXISTS volumes CASCADE;
      DROP TABLE IF EXISTS instances CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `
  }
];

export async function runMigrations() {
  const client = await db.connect();

  try {
    // Create migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run pending migrations
    for (const migration of migrations) {
      const result = await client.query(
        'SELECT * FROM migrations WHERE id = $1',
        [migration.id]
      );

      if (result.rows.length === 0) {
        logger.info(`Running migration: ${migration.id}`);
        await client.query(migration.up);
        await client.query(
          'INSERT INTO migrations (id) VALUES ($1)',
          [migration.id]
        );
        logger.info(`Migration completed: ${migration.id}`);
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function rollbackMigration(migrationId: string) {
  const client = await db.connect();

  try {
    const migration = migrations.find((m) => m.id === migrationId);

    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    logger.info(`Rolling back migration: ${migrationId}`);
    await client.query(migration.down);
    await client.query('DELETE FROM migrations WHERE id = $1', [migrationId]);
    logger.info(`Migration rollback completed: ${migrationId}`);
  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
