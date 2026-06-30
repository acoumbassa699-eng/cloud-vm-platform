import { Router, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthRequest, authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

/**
 * @swagger
 * /api/v1/billing/invoices:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get billing invoices for project
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invoices
 */
router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, period_start, period_end, subtotal, tax, total, status, due_date, paid_at, created_at
       FROM billing WHERE project_id = $1 ORDER BY period_start DESC`,
      [req.projectId]
    );

    res.json({
      success: true,
      invoices: result.rows
    });
  } catch (error) {
    logger.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

/**
 * @swagger
 * /api/v1/billing/invoices/{id}:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get invoice details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details
 */
router.get('/invoices/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM billing WHERE id = $1 AND project_id = $2`,
      [req.params.id, req.projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      success: true,
      invoice: result.rows[0]
    });
  } catch (error) {
    logger.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

/**
 * @swagger
 * /api/v1/billing/summary:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get billing summary for project
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing summary
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as total_invoices,
        SUM(total) as total_amount,
        SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'pending' THEN total ELSE 0 END) as pending_amount
       FROM billing WHERE project_id = $1`,
      [req.projectId]
    );

    res.json({
      success: true,
      summary: result.rows[0]
    });
  } catch (error) {
    logger.error('Get billing summary error:', error);
    res.status(500).json({ error: 'Failed to get billing summary' });
  }
});

export default router;
