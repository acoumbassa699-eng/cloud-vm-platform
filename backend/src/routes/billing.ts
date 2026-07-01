import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

const BILLING_HOURLY_RATE_PER_VCPU = parseFloat(process.env.BILLING_HOURLY_RATE_PER_VCPU || '0.10');
const BILLING_HOURLY_RATE_PER_GB_RAM = parseFloat(process.env.BILLING_HOURLY_RATE_PER_GB_RAM || '0.05');
const BILLING_HOURLY_RATE_PER_GB_STORAGE = parseFloat(process.env.BILLING_HOURLY_RATE_PER_GB_STORAGE || '0.01');
const BILLING_CURRENCY = process.env.BILLING_CURRENCY || 'USD';

/**
 * @swagger
 * /api/v1/billing/usage:
 *   get:
 *     summary: Get current billing usage
 *     security:
 *       - bearerAuth: []
 */
router.get('/usage', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { projectId } = req.query;

    let query = `
      SELECT 
        SUM(i.vcpus) as total_vcpus,
        SUM(i.ram) as total_ram_gb,
        SUM(i.disk) as total_disk_gb,
        COUNT(i.id) as instance_count,
        SUM(CASE WHEN i.status = 'ACTIVE' THEN 1 ELSE 0 END) as running_instances
      FROM instances i
      WHERE i.user_id = $1 AND i.status != 'deleted'
    `;
    const params: any[] = [userId];

    if (projectId) {
      query += ' AND i.project_id = $2';
      params.push(projectId);
    }

    const result = await db.query(query, params);
    const usage = result.rows[0];

    // Calculate monthly cost
    const monthlyVCPUCost = (usage.total_vcpus || 0) * BILLING_HOURLY_RATE_PER_VCPU * 730;
    const monthlyRAMCost = (usage.total_ram_gb || 0) * BILLING_HOURLY_RATE_PER_GB_RAM * 730;
    const monthlyStorageCost = (usage.total_disk_gb || 0) * BILLING_HOURLY_RATE_PER_GB_STORAGE * 730;
    const totalMonthlyCost = monthlyVCPUCost + monthlyRAMCost + monthlyStorageCost;

    res.json({
      resources: {
        vcpus: usage.total_vcpus || 0,
        ram_gb: usage.total_ram_gb || 0,
        disk_gb: usage.total_disk_gb || 0,
        instance_count: usage.instance_count || 0,
        running_instances: usage.running_instances || 0
      },
      costs: {
        vcpu_monthly: monthlyVCPUCost,
        ram_monthly: monthlyRAMCost,
        storage_monthly: monthlyStorageCost,
        total_monthly: totalMonthlyCost,
        currency: BILLING_CURRENCY
      }
    });
  } catch (error) {
    logger.error('Failed to get usage:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/billing/invoices:
 *   get:
 *     summary: Get invoices
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { month, year } = req.query;

    let query = 'SELECT * FROM invoices WHERE user_id = $1';
    const params: any[] = [userId];

    if (month && year) {
      query += ' AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3';
      params.push(month, year);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    const invoices = result.rows.map((row: any) => ({
      id: row.id,
      number: row.invoice_number,
      month: row.billing_month,
      amount: row.total_amount,
      currency: BILLING_CURRENCY,
      status: row.status,
      created_at: row.created_at,
      due_date: row.due_date
    }));

    res.json({ invoices });
  } catch (error) {
    logger.error('Failed to get invoices:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/billing/invoices/{id}:
 *   get:
 *     summary: Get invoice details
 *     security:
 *       - bearerAuth: []
 */
router.get('/invoices/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = result.rows[0];

    // Get line items
    const itemsResult = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1',
      [id]
    );

    const lineItems = itemsResult.rows.map((row: any) => ({
      id: row.id,
      description: row.description,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total: row.total
    }));

    res.json({
      invoice: {
        id: invoice.id,
        number: invoice.invoice_number,
        month: invoice.billing_month,
        amount: invoice.total_amount,
        currency: BILLING_CURRENCY,
        status: invoice.status,
        created_at: invoice.created_at,
        due_date: invoice.due_date
      },
      line_items: lineItems
    });
  } catch (error) {
    logger.error('Failed to get invoice:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/billing/cost-analysis:
 *   get:
 *     summary: Get cost analysis
 *     security:
 *       - bearerAuth: []
 */
router.get('/cost-analysis', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { projectId } = req.query;

    let query = `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        project_id,
        SUM(
          (vcpus * $1 * 24) +
          (ram * $2 * 24) +
          (disk * $3 * 24)
        ) as daily_cost
      FROM instances
      WHERE user_id = $4 AND status != 'deleted'
    `;
    const params: any[] = [
      BILLING_HOURLY_RATE_PER_VCPU,
      BILLING_HOURLY_RATE_PER_GB_RAM,
      BILLING_HOURLY_RATE_PER_GB_STORAGE,
      userId
    ];

    if (projectId) {
      query += ' AND project_id = $5';
      params.push(projectId);
    }

    query += ' GROUP BY date, project_id ORDER BY date DESC LIMIT 30';

    const result = await db.query(query, params);

    const analysis = result.rows.map((row: any) => ({
      date: row.date,
      project_id: row.project_id,
      cost: row.daily_cost,
      currency: BILLING_CURRENCY
    }));

    res.json({ daily_costs: analysis });
  } catch (error) {
    logger.error('Failed to get cost analysis:', error);
    next(error);
  }
});

export default router;
