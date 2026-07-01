import { Job } from 'bull';
import { query } from '../database/connection';
import { storageService } from '../core/openstack/storage';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

    const volumeRow = await query(
      `SELECT provider_id FROM volumes WHERE instance_id = $1 AND project_id = $2 LIMIT 1`,
      [instanceId, projectId]
    );

    if (volumeRow.rows.length === 0) throw new Error('No volume found for instance');
    const volumeProviderId = volumeRow.rows[0].provider_id;

    const snapshot = await storageService.createSnapshot({
      volume_id: volumeProviderId,
      name: snapshotName,
      description: `Snapshot of instance ${instanceId}`
    });

    logger.info(`Snapshot created in Cinder: ${snapshot.id}`);

    let isReady = false;
    for (let i = 0; i < 120; i++) {
      const current = await storageService.getSnapshot(snapshot.id);
      if (current.status === 'available') {
        isReady = true;
        break;
      }
      if (current.status === 'error') throw new Error(`Snapshot creation failed: ${current.error_detail || 'Unknown error'}`);
      await new Promise(r => setTimeout(r, 5000));
    }

    if (!isReady) throw new Error('Snapshot creation timeout');

    const snapshotId = uuidv4();
    await query(
      `INSERT INTO snapshots (id, instance_id, provider_snapshot_id, name, description, size, state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [snapshotId, instanceId, snapshot.id, snapshotName, `Snapshot of instance ${instanceId}`, snapshot.size, 'available']
    );

    return { success: true, snapshotId, snapshotProviderId: snapshot.id, status: 'available' };
  } catch (error) {
    logger.error(`Failed to create snapshot ${snapshotName}:`, error);
    throw error;
  }
}
