import { Job } from 'bull';
import { query } from '../database/connection';
import { novaClient } from '../services/nova';
import { logger } from '../utils/logger';

interface CollectMetricsJobData {
  projectId: string;
  instanceId: string;
}

interface InstanceMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network_in: number;
  network_out: number;
  uptime: number;
}

export async function collectMetricsJob(
  job: Job<CollectMetricsJobData>
): Promise<any> {
  const { projectId, instanceId } = job.data;

  try {
    // Get instance details
    const instanceRow = await query(
      `SELECT provider_id, cpu, ram FROM instances WHERE id = $1 AND project_id = $2`,
      [instanceId, projectId]
    );

    if (instanceRow.rows.length === 0) {
      logger.warn(`Instance not found for metrics collection: ${instanceId}`);
      return { success: false, reason: 'Instance not found' };
    }

    const { provider_id: providerId, cpu, ram } = instanceRow.rows[0];

    // Get instance metrics from Nova
    const novaInstance = await novaClient.getInstance(providerId);
    
    if (!novaInstance) {
      logger.warn(`Unable to get instance metrics from Nova: ${providerId}`);
      return { success: false, reason: 'Instance not found in Nova' };
    }

    // Extract available metrics
    const metrics: InstanceMetrics = {
      cpu: cpu || 0,
      memory: ram || 0,
      disk: novaInstance.disk || 0,
      network_in: 0,
      network_out: 0,
      uptime: Math.floor((Date.now() - new Date(novaInstance.created).getTime()) / 1000)
    };

    // Store metrics in database
    await query(
      `INSERT INTO instance_metrics (instance_id, cpu, memory, disk, network_in, network_out, uptime, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (instance_id, collected_at) DO UPDATE SET
       cpu = $2, memory = $3, disk = $4, network_in = $5, network_out = $6, uptime = $7`,
      [instanceId, metrics.cpu, metrics.memory, metrics.disk, metrics.network_in, metrics.network_out, metrics.uptime]
    );

    logger.debug(`Metrics collected for instance: ${instanceId}`, metrics);

    return {
      success: true,
      instanceId,
      metrics
    };
  } catch (error) {
    logger.error(`Failed to collect metrics for instance ${instanceId}:`, error);
    throw error;
  }
}
