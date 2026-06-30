import { Job } from 'bull';
import { query } from '../database/connection';
import { novaClient } from '../services/nova';
import { logger } from '../utils/logger';
import { deleteCache } from '../services/redis';

interface StopInstanceJobData {
  projectId: string;
  instanceId: string;
}

export async function stopInstanceJob(
  job: Job<StopInstanceJobData>
): Promise<any> {
  const { projectId, instanceId } = job.data;

  try {
    logger.info(`Stopping instance: ${instanceId}`);

    // Get instance details
    const instanceRow = await query(
      `SELECT provider_id FROM instances WHERE id = $1 AND project_id = $2`,
      [instanceId, projectId]
    );

    if (instanceRow.rows.length === 0) {
      throw new Error('Instance not found');
    }

    const providerId = instanceRow.rows[0].provider_id;

    // Update instance state to STOPPING
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['STOPPING', instanceId]
    );

    // Stop instance in Nova
    await novaClient.stopInstance(providerId);

    logger.info(`Stop command sent to instance: ${providerId}`);

    // Poll for instance to be in STOPPED state
    let isStopped = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!isStopped && attempts < maxAttempts) {
      const currentInstance = await novaClient.getInstance(providerId);
      
      if (currentInstance.status === 'SHUTOFF') {
        isStopped = true;
      } else if (currentInstance.status === 'ERROR') {
        throw new Error(`Instance stop failed: ${currentInstance['fault']?.message || 'Unknown error'}`);
      }

      if (!isStopped) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    if (!isStopped) {
      throw new Error('Instance stop timeout');
    }

    // Update instance state to STOPPED
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['STOPPED', instanceId]
    );

    logger.info(`Instance stopped successfully: ${instanceId}`);

    await deleteCache(`nova:instance:${providerId}`);

    return {
      success: true,
      instanceId,
      status: 'STOPPED'
    };
  } catch (error) {
    logger.error(`Failed to stop instance ${instanceId}:`, error);

    // Update instance state to ERROR
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['ERROR', instanceId]
    );

    throw error;
  }
}
