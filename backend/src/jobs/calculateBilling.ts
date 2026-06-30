import { Job } from 'bull';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

interface CalculateBillingJobData {
  projectId: string;
}

export async function calculateBillingJob(
  job: Job<CalculateBillingJobData>
): Promise<any> {
  const { projectId } = job.data;

  try {
    logger.info(`Calculating billing for project: ${projectId}`);

    // Get project details
    const projectRow = await query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectRow.rows.length === 0) {
      throw new Error('Project not found');
    }

    // Calculate billing for current month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get all instances for the project that were active during the period
    const instancesResult = await query(
      `SELECT id, cpu, ram, storage, created_at, deleted_at FROM instances 
       WHERE project_id = $1 
       AND created_at <= $2
       AND (deleted_at IS NULL OR deleted_at >= $3)`,
      [projectId, lastDayOfMonth, firstDayOfMonth]
    );

    const billingRates = {
      cpuPerHour: parseFloat(process.env.BILLING_HOURLY_RATE_PER_VCPU || '0.10'),
      ramPerHour: parseFloat(process.env.BILLING_HOURLY_RATE_PER_GB_RAM || '0.05'),
      storagePerHour: parseFloat(process.env.BILLING_HOURLY_RATE_PER_GB_STORAGE || '0.01')
    };

    let totalCpuHours = 0;
    let totalRamHours = 0;
    let totalStorageHours = 0;

    for (const instance of instancesResult.rows) {
      const createdAt = new Date(instance.created_at);
      const deletedAt = instance.deleted_at ? new Date(instance.deleted_at) : lastDayOfMonth;

      // Calculate hours the instance was active
      const startDate = createdAt > firstDayOfMonth ? createdAt : firstDayOfMonth;
      const endDate = deletedAt < lastDayOfMonth ? deletedAt : lastDayOfMonth;
      const hoursActive = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      totalCpuHours += instance.cpu * hoursActive;
      totalRamHours += instance.ram * hoursActive;
      totalStorageHours += instance.storage * hoursActive;
    }

    // Calculate subtotal
    const cpuCost = totalCpuHours * billingRates.cpuPerHour;
    const ramCost = totalRamHours * billingRates.ramPerHour;
    const storageCost = totalStorageHours * billingRates.storagePerHour;
    const subtotal = cpuCost + ramCost + storageCost;

    // Calculate tax (assuming 10% tax rate)
    const taxRate = 0.10;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // Check if billing already exists for this period
    const existingBilling = await query(
      `SELECT id FROM billing 
       WHERE project_id = $1 
       AND period_start = $2 
       AND period_end = $3`,
      [projectId, firstDayOfMonth, lastDayOfMonth]
    );

    if (existingBilling.rows.length > 0) {
      // Update existing billing
      await query(
        `UPDATE billing SET 
         cpu_hours = $1, 
         ram_hours = $2, 
         storage_hours = $3, 
         subtotal = $4, 
         tax = $5, 
         total = $6 
         WHERE id = $7`,
        [totalCpuHours, totalRamHours, totalStorageHours, subtotal, tax, total, existingBilling.rows[0].id]
      );
    } else {
      // Create new billing record
      await query(
        `INSERT INTO billing 
         (project_id, period_start, period_end, cpu_hours, ram_hours, storage_hours, subtotal, tax, total, status, due_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          projectId,
          firstDayOfMonth,
          lastDayOfMonth,
          totalCpuHours,
          totalRamHours,
          totalStorageHours,
          subtotal,
          tax,
          total,
          'pending',
          new Date(lastDayOfMonth.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days due date
        ]
      );
    }

    logger.info(`Billing calculated for project: ${projectId}`, {
      cpuHours: totalCpuHours,
      ramHours: totalRamHours,
      storageHours: totalStorageHours,
      subtotal,
      tax,
      total
    });

    return {
      success: true,
      projectId,
      billingData: {
        cpuHours: totalCpuHours,
        ramHours: totalRamHours,
        storageHours: totalStorageHours,
        subtotal,
        tax,
        total
      }
    };
  } catch (error) {
    logger.error(`Failed to calculate billing for project ${projectId}:`, error);
    throw error;
  }
}
