import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { Pool } from 'pg';
import axios from 'axios';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'cloudvm';
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'cloudvm_metrics';

interface MetricsQuery {
  instanceId?: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  start: string;
  end?: string;
}

/**
 * @swagger
 * /api/v1/monitoring/metrics:
 *   get:
 *     summary: Get instance metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instanceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *         description: cpu, memory, disk, or network
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *         description: ISO 8601 timestamp
 */
router.get('/metrics', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { instanceId, metric, start, end } = req.query;

    // Verify ownership
    if (instanceId) {
      const result = await db.query(
        'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
        [instanceId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }
    }

    // Query InfluxDB
    const query = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${start}, stop: ${end || 'now()'})
        |> filter(fn: (r) => r._measurement == "${metric}")
        ${instanceId ? `|> filter(fn: (r) => r.instanceId == "${instanceId}")` : ''}
        |> mean()
    `;

    const response = await axios.post(
      `${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`,
      query,
      {
        headers: {
          'Authorization': `Token ${INFLUXDB_TOKEN}`,
          'Content-Type': 'application/vnd.flux'
        }
      }
    );

    res.json({ metrics: response.data });
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts:
 *   get:
 *     summary: List monitoring alerts
 *     security:
 *       - bearerAuth: []
 */
router.get('/alerts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { projectId } = req.query;

    let query = 'SELECT * FROM alerts WHERE user_id = $1';
    const params: any[] = [userId];

    if (projectId) {
      query += ' AND project_id = $2';
      params.push(projectId);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await db.query(query, params);

    const alerts = result.rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      resourceId: row.resource_id,
      resourceType: row.resource_type,
      resolved: row.resolved,
      created_at: row.created_at,
      resolved_at: row.resolved_at
    }));

    res.json({ alerts });
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/monitoring/alerts/{id}:
 *   put:
 *     summary: Resolve an alert
 *     security:
 *       - bearerAuth: []
 */
router.put('/alerts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { resolved } = req.body;

    // Verify ownership
    const result = await db.query(
      'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await db.query(
      'UPDATE alerts SET resolved = $1, resolved_at = NOW() WHERE id = $2',
      [resolved, id]
    );

    res.json({ message: 'Alert updated' });
  } catch (error) {
    logger.error('Failed to update alert:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/monitoring/instance/{instanceId}/health:
 *   get:
 *     summary: Get instance health status
 *     security:
 *       - bearerAuth: []
 */
router.get('/instance/:instanceId/health', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { instanceId } = req.params;

    // Verify ownership
    const result = await db.query(
      'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
      [instanceId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const instance = result.rows[0];

    // Get recent metrics from InfluxDB
    const query = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r.instanceId == "${instanceId}")
        |> last()
    `;

    const response = await axios.post(
      `${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`,
      query,
      {
        headers: {
          'Authorization': `Token ${INFLUXDB_TOKEN}`,
          'Content-Type': 'application/vnd.flux'
        }
      }
    );

    res.json({
      instanceId,
      status: instance.status,
      health: 'healthy',
      lastMetrics: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get instance health:', error);
    next(error);
  }
});

export default router;
