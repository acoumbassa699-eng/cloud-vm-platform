import { Router, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthRequest, authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

/**
 * @swagger
 * /api/v1/monitoring/{instanceId}:
 *   get:
 *     tags:
 *       - Monitoring
 *     summary: Get instance metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Instance metrics
 */
router.get('/:instanceId', async (req: AuthRequest, res: Response) => {
  try {
    const { instanceId } = req.params;

    // Verify instance belongs to project
    const instanceResult = await query(
      `SELECT id FROM instances WHERE id = $1 AND project_id = $2`,
      [instanceId, req.projectId]
    );

    if (instanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Get latest metrics
    const metricsResult = await query(
      `SELECT cpu, memory, disk, network_in, network_out, uptime, collected_at
       FROM instance_metrics WHERE instance_id = $1
       ORDER BY collected_at DESC LIMIT 100`,
      [instanceId]
    );

    res.json({
      success: true,
      metrics: metricsResult.rows
    });
  } catch (error) {
    logger.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * @swagger
 * /api/v1/monitoring/{instanceId}/latest:
 *   get:
 *     tags:
 *       - Monitoring
 *     summary: Get latest metrics for instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Latest metrics
 */
router.get('/:instanceId/latest', async (req: AuthRequest, res: Response) => {
  try {
    const { instanceId } = req.params;

    // Verify instance belongs to project
    const instanceResult = await query(
      `SELECT id FROM instances WHERE id = $1 AND project_id = $2`,
      [instanceId, req.projectId]
    );

    if (instanceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Get latest metrics
    const metricsResult = await query(
      `SELECT cpu, memory, disk, network_in, network_out, uptime, collected_at
       FROM instance_metrics WHERE instance_id = $1
       ORDER BY collected_at DESC LIMIT 1`,
      [instanceId]
    );

    if (metricsResult.rows.length === 0) {
      return res.json({
        success: true,
        metrics: null
      });
    }

    res.json({
      success: true,
      metrics: metricsResult.rows[0]
    });
  } catch (error) {
    logger.error('Get latest metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

export default router;
