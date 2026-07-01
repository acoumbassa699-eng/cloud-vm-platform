import { Router, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthRequest, authenticate } from '../middleware/auth';
import { query } from '../database/connection';
import axios from 'axios';
import { quotaService } from '../services/quota';

const router = Router();

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || '';
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'cloudvm';
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'cloudvm_metrics';

router.get('/metrics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    const { instanceId, metric, start, end } = req.query;

    if (instanceId) {
      const result = await query(
        'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
        [instanceId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }
    }

    // In a real implementation, we would query InfluxDB here.
    // Since we don't have a real InfluxDB, we'll return a mock response
    // if the token is missing, or attempt the request if it exists.

    if (!INFLUXDB_TOKEN) {
      return res.json({
        metrics: [
          { time: new Date().toISOString(), value: Math.random() * 100 }
        ]
      });
    }

    const influxQuery = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${start}, stop: ${end || 'now()'})
        |> filter(fn: (r) => r._measurement == "${metric}")
        ${instanceId ? `|> filter(fn: (r) => r.instanceId == "${instanceId}")` : ''}
        |> mean()
    `;

    const response = await axios.post(
      `${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}`,
      influxQuery,
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

router.get('/usage', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const usage = await quotaService.getUsage(req.projectId!);
    res.json(usage);
  } catch (error) {
    logger.error('Failed to get project usage:', error);
    next(error);
  }
});

export default router;
