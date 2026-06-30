import { Job } from 'bull';
import { query } from '../database/connection';
import { cinderClient } from '../services/cinder';
import { logger } from '../utils/logger';

interface CreateSnapshotJobData {
  projectId: string;
  instanceId: string;
  snapshotName: string;
}

export async function createSnapshotJob(
  job: Job<CreateSnapshotJobData>
): Promise<any> {
  const { projectId, instanceId, snapshotName } = job.data;

  try {
    logger.info(`Creating snapshot: ${snapshotName} for instance: ${instanceId}`);

    // Get volume associated with instance
    const volumeRow = await query(
      `SELECT provider_id FROM volumes WHERE instance_id = $1 AND project_id = $2 LIMIT 1`,
      [instanceId, projectId]
    );

    if (volumeRow.rows.length === 0) {
      throw new Error('No volume found for instance');
    }

    const volumeProviderId = volumeRow.rows[0].provider_id;

    // Create snapshot in Cinder
    const cinderSnapshot = await cinderClient.createSnapshot({
      volumeId: volumeProviderId,
      name: snapshotName,
      description: `Snapshot of instance ${instanceId}`
    });

    logger.info(`Snapshot created in Cinder: ${cinderSnapshot.id}`);

    // Poll for snapshot to be available
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes

    while (!isReady && attempts < maxAttempts) {
      const currentSnapshot = await cinderClient.getSnapshot(cinderSnapshot.id);
      
      if (currentSnapshot.status === 'available') {
        isReady = true;
      } else if (currentSnapshot.status === 'error') {
        throw new Error(`Snapshot creation failed: ${currentSnapshot['error_detail'] || 'Unknown error'}`);
      }

      if (!isReady) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    if (!isReady) {
      throw new Error('Snapshot creation timeout');
    }

    // Store snapshot in database
    const snapshotId = require('uuid').v4();
    await query(
      `INSERT INTO snapshots (id, instance_id, provider_snapshot_id, name, description, size, state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [snapshotId, instanceId, cinderSnapshot.id, snapshotName, `Snapshot of instance ${instanceId}`, cinderSnapshot.size, 'available']
    );

    logger.info(`Snapshot created successfully: ${snapshotId}`);

    return {
      success: true,
      snapshotId,
      snapshotProviderId: cinderSnapshot.id,
      status: 'available'
    };
  } catch (error) {
    logger.error(`Failed to create snapshot ${snapshotName}:`, error);
    throw error;
  }
}
