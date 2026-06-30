import { Router, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthRequest, authenticateJWT } from '../middleware/auth';
import { v4 as uuid } from 'uuid';
import { enqueueInstanceCreation, enqueueInstanceDeletion, enqueueInstanceStart, enqueueInstanceStop, enqueueInstanceReboot, enqueueSnapshotCreation } from '../services/queue';
import { novaClient } from '../services/nova';
import { deleteCache } from '../services/redis';

const router = Router();

router.use(authenticateJWT);

/**
 * @swagger
 * /api/v1/instances:
 *   get:
 *     tags:
 *       - Instances
 *     summary: List all instances in project
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of instances
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, state, cpu, ram, storage, ip_address, image_name, created_at, updated_at 
       FROM instances WHERE project_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [req.projectId]
    );

    res.json({
      success: true,
      instances: result.rows
    });
  } catch (error) {
    logger.error('List instances error:', error);
    res.status(500).json({ error: 'Failed to list instances' });
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}:
 *   get:
 *     tags:
 *       - Instances
 *     summary: Get instance details
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
 *         description: Instance details
 *       404:
 *         description: Instance not found
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM instances WHERE id = $1 AND project_id = $2`,
      [req.params.id, req.projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    res.json({
      success: true,
      instance: result.rows[0]
    });
  } catch (error) {
    logger.error('Get instance error:', error);
    res.status(500).json({ error: 'Failed to get instance' });
  }
});

/**
 * @swagger
 * /api/v1/instances:
 *   post:
 *     tags:
 *       - Instances
 *     summary: Create a new instance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               imageId:
 *                 type: string
 *               flavorId:
 *                 type: string
 *               networkId:
 *                 type: string
 *               cpu:
 *                 type: number
 *               ram:
 *                 type: number
 *               storage:
 *                 type: number
 *     responses:
 *       202:
 *         description: Instance creation started
 *       400:
 *         description: Invalid input
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, imageId, flavorId, networkId, cpu, ram, storage, keypairName, securityGroups } = req.body;

    // Validate input
    if (!name || !imageId || !flavorId || !networkId || !cpu || !ram || !storage) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'INVALID_INPUT'
      });
    }

    // Check project quota
    const projectResult = await query(
      `SELECT quota_cpu, quota_ram, quota_storage, quota_instances FROM projects WHERE id = $1`,
      [req.projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get current usage
    const usageResult = await query(
      `SELECT COALESCE(SUM(cpu), 0) as total_cpu, COALESCE(SUM(ram), 0) as total_ram, 
              COALESCE(SUM(storage), 0) as total_storage, COUNT(*) as instance_count
       FROM instances WHERE project_id = $1 AND deleted_at IS NULL`,
      [req.projectId]
    );

    const usage = usageResult.rows[0];

    // Check quota
    if (usage.total_cpu + cpu > project.quota_cpu) {
      return res.status(400).json({
        error: 'CPU quota exceeded',
        code: 'QUOTA_EXCEEDED'
      });
    }
    if (usage.total_ram + ram > project.quota_ram) {
      return res.status(400).json({
        error: 'RAM quota exceeded',
        code: 'QUOTA_EXCEEDED'
      });
    }
    if (usage.total_storage + storage > project.quota_storage) {
      return res.status(400).json({
        error: 'Storage quota exceeded',
        code: 'QUOTA_EXCEEDED'
      });
    }
    if (usage.instance_count + 1 > project.quota_instances) {
      return res.status(400).json({
        error: 'Instance quota exceeded',
        code: 'QUOTA_EXCEEDED'
      });
    }

    // Create instance record
    const instanceId = uuid();
    await query(
      `INSERT INTO instances (id, project_id, name, state, cpu, ram, storage, image_id, image_name, network_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [instanceId, req.projectId, name, 'CREATING', cpu, ram, storage, imageId, name, networkId]
    );

    // Enqueue instance creation job
    const jobId = await enqueueInstanceCreation(req.projectId, {
      instanceId,
      name,
      imageId,
      flavorId,
      networkId,
      cpu,
      ram,
      storage,
      keypairName,
      securityGroups
    });

    logger.info(`Instance creation enqueued: ${instanceId}`);

    res.status(202).json({
      success: true,
      instanceId,
      jobId,
      status: 'CREATING'
    });
  } catch (error) {
    logger.error('Create instance error:', error);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}/start:
 *   post:
 *     tags:
 *       - Instances
 *     summary: Start an instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Instance start initiated
 */
router.post('/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id FROM instances WHERE id = $1 AND project_id = $2`,
      [req.params.id, req.projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const jobId = await enqueueInstanceStart(req.projectId, req.params.id);

    res.status(202).json({
      success: true,
      instanceId: req.params.id,
      jobId,
      status: 'STARTING'
    });
  } catch (error) {
    logger.error('Start instance error:', error);
    res.status(500).json({ error: 'Failed to start instance' });
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}/stop:
 *   post:
 *     tags:
 *       - Instances
 *     summary: Stop an instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Instance stop initiated
 */
router.post('/:id/stop', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id FROM instances WHERE id = $1 AND project_id = $2`,
      [req.params.id, req.projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const jobId = await enqueueInstanceStop(req.projectId, req.params.id);

    res.status(202).json({
      success: true,
      instanceId: req.params.id,
      jobId,
      status: 'STOPPING'
    });
  } catch (error) {
    logger.error('Stop instance error:', error);
    res.status(500).json({ error: 'Failed to stop instance' });
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}/reboot:
 *   post:
 *     tags:
 *       - Instances
 *     summary: Reboot an instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hardReboot:
 *                 type: boolean
 *     responses:
 *       202:
 *         description: Instance reboot initiated
 */
router.post('/:id/reboot', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id FROM instances WHERE id = $1 AND project_id = $2`,
      [req.params.id, req.projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const { hardReboot = false } = req.body;
    const jobId = await enqueueInstanceReboot(req.projectId, req.params.id, hardReboot);

    res.status(202).json({
      success: true,
      instanceId: req.params.id,
      jobId,
      status: 'REBOOTING'
    });
  } catch (error) {
    logger.error('Reboot instance error:', error);
    res.status(500).json({ error: 'Failed to reboot instance' });
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}:
 *   delete:
 *     tags:
 *       - Instances
 *     summary: Delete an instance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Instance deletion initiated
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id FROM instances WHERE id = $1 AND project_id = $2`,
      [req.params.id, req.projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const jobId = await enqueueInstanceDeletion(req.projectId, req.params.id);

    res.status(202).json({
      success: true,
      instanceId: req.params.id,
      jobId,
      status: 'DELETING'
    });
  } catch (error) {
    logger.error('Delete instance error:', error);
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});

export default router;
