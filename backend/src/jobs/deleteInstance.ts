import { Job } from 'bull';
import { query } from '../database/connection';
import { novaClient } from '../services/nova';
import { cinderClient } from '../services/cinder';
import { logger } from '../utils/logger';
import { deleteCache } from '../services/redis';

interface DeleteInstanceJobData {
  projectId: string;
  instanceId: string;
}

export async function deleteInstanceJob(
  job: Job<DeleteInstanceJobData>
): Promise<any> {
  const { projectId, instanceId } = job.data;

  try {
    logger.info(`Deleting instance: ${instanceId}`);

    // Get instance details
    const instanceRow = await query(
      `SELECT provider_id FROM instances WHERE id = $1 AND project_id = $2`,
      [instanceId, projectId]
    );

    if (instanceRow.rows.length === 0) {
      throw new Error('Instance not found');
    }

    const providerId = instanceRow.rows[0].provider_id;

    // Update instance state to DELETING
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['DELETING', instanceId]
    );

    // Delete instance from Nova
    await novaClient.deleteInstance(providerId);

    logger.info(`Instance deleted from Nova: ${providerId}`);

    // Get volumes associated with instance
    const volumesResult = await query(
      `SELECT provider_id FROM volumes WHERE instance_id = $1`,
      [instanceId]
    );

    // Detach and delete volumes
    for (const volumeRow of volumesResult.rows) {
      try {
        await cinderClient.detachVolume(volumeRow.provider_id);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await cinderClient.deleteVolume(volumeRow.provider_id);
        logger.info(`Volume deleted: ${volumeRow.provider_id}`);
      } catch (error) {
        logger.warn(`Failed to delete volume ${volumeRow.provider_id}:`, error);
      }
    }

    // Update instance in database to mark as deleted
    await query(
      `UPDATE instances SET state = $1, deleted_at = NOW(), updated_at = NOW() WHERE id = $2`,
      ['DELETED', instanceId]
    );

    logger.info(`Instance deleted successfully: ${instanceId}`);

    await deleteCache(`nova:instance:${providerId}`);

    return {
      success: true,
      instanceId,
      status: 'DELETED'
    };
  } catch (error) {
    logger.error(`Failed to delete instance ${instanceId}:`, error);

    // Update instance state to ERROR
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['ERROR', instanceId]
    );

    throw error;
  }
}
