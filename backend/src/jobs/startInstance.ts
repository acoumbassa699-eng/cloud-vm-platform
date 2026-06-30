import { Job } from 'bull';
import { query } from '../database/connection';
import { novaClient } from '../services/nova';
import { logger } from '../utils/logger';
import { deleteCache } from '../services/redis';

interface StartInstanceJobData {
  projectId: string;
  instanceId: string;
}

export async function startInstanceJob(
  job: Job<StartInstanceJobData>
): Promise<any> {
  const { projectId, instanceId } = job.data;

  try {
    logger.info(`Starting instance: ${instanceId}`);

    // Get instance details
    const instanceRow = await query(
      `SELECT provider_id FROM instances WHERE id = $1 AND project_id = $2`,
      [instanceId, projectId]
    );

    if (instanceRow.rows.length === 0) {
      throw new Error('Instance not found');
    }

    const providerId = instanceRow.rows[0].provider_id;

    // Update instance state to STARTING
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['STARTING', instanceId]
    );

    // Start instance in Nova
    await novaClient.startInstance(providerId);

    logger.info(`Start command sent to instance: ${providerId}`);

    // Poll for instance to be in ACTIVE state
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!isReady && attempts < maxAttempts) {
      const currentInstance = await novaClient.getInstance(providerId);
      
      if (currentInstance.status === 'ACTIVE') {
        isReady = true;
      } else if (currentInstance.status === 'ERROR') {
        throw new Error(`Instance start failed: ${currentInstance['fault']?.message || 'Unknown error'}`);
      }

      if (!isReady) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    if (!isReady) {
      throw new Error('Instance start timeout');
    }

    // Update instance state to RUNNING
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['RUNNING', instanceId]
    );

    logger.info(`Instance started successfully: ${instanceId}`);

    await deleteCache(`nova:instance:${providerId}`);

    return {
      success: true,
      instanceId,
      status: 'RUNNING'
    };
  } catch (error) {
    logger.error(`Failed to start instance ${instanceId}:`, error);

    // Update instance state to ERROR
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['ERROR', instanceId]
    );

    throw error;
  }
}
