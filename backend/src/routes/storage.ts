import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { cinderService } from '../../services/openstack/cinder';
import { validateRequest } from '../../middleware/validation';
import Joi from 'joi';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * @swagger
 * /api/v1/storage/volumes:
 *   get:
 *     summary: List all volumes
 *     security:
 *       - bearerAuth: []
 */
router.get('/volumes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get volumes from database
    const result = await db.query(
      'SELECT * FROM volumes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const volumes = result.rows.map((row: any) => ({
      id: row.openstack_id,
      name: row.name,
      size: row.size,
      status: row.status,
      created_at: row.created_at,
      project_id: row.project_id
    }));

    res.json({ volumes });
  } catch (error) {
    logger.error('Failed to list volumes:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/storage/volumes:
 *   post:
 *     summary: Create a new volume
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/volumes',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string().required(),
      size: Joi.number().min(1).required(),
      projectId: Joi.string().required(),
      volumeType: Joi.string()
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { name, size, projectId, volumeType } = req.body;

      // Verify user owns project
      const projectCheck = await db.query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Project not found' });
      }

      // Create volume in OpenStack
      const volumeData = await cinderService.createVolume(name, size, volumeType);

      // Store in database
      const volumeId = uuidv4();
      await db.query(
        `INSERT INTO volumes (id, user_id, project_id, openstack_id, name, size, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [volumeId, userId, projectId, volumeData.id, name, size, volumeData.status]
      );

      res.status(201).json({
        id: volumeData.id,
        name: volumeData.name,
        size: volumeData.size,
        status: volumeData.status
      });
    } catch (error) {
      logger.error('Failed to create volume:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/storage/snapshots:
 *   get:
 *     summary: List all snapshots
 *     security:
 *       - bearerAuth: []
 */
router.get('/snapshots', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM snapshots WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const snapshots = result.rows.map((row: any) => ({
      id: row.openstack_id,
      name: row.name,
      size: row.size,
      status: row.status,
      volume_id: row.volume_id,
      created_at: row.created_at,
      project_id: row.project_id
    }));

    res.json({ snapshots });
  } catch (error) {
    logger.error('Failed to list snapshots:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/storage/snapshots:
 *   post:
 *     summary: Create a volume snapshot
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/snapshots',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string().required(),
      volumeId: Joi.string().required(),
      projectId: Joi.string().required()
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { name, volumeId, projectId } = req.body;

      // Verify ownership
      const volumeCheck = await db.query(
        'SELECT * FROM volumes WHERE openstack_id = $1 AND user_id = $2',
        [volumeId, userId]
      );

      if (volumeCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Volume not found' });
      }

      // Create snapshot in OpenStack
      const snapshotData = await cinderService.createSnapshot(volumeId, name);

      // Store in database
      const snapshotId = uuidv4();
      await db.query(
        `INSERT INTO snapshots (id, user_id, project_id, openstack_id, name, size, status, volume_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [snapshotId, userId, projectId, snapshotData.id, name, snapshotData.size, snapshotData.status, volumeId]
      );

      res.status(201).json({
        id: snapshotData.id,
        name: snapshotData.name,
        volume_id: volumeId,
        status: snapshotData.status
      });
    } catch (error) {
      logger.error('Failed to create snapshot:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/storage/snapshots/{id}:
 *   delete:
 *     summary: Delete a snapshot
 *     security:
 *       - bearerAuth: []
 */
router.delete('/snapshots/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM snapshots WHERE openstack_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    await cinderService.deleteSnapshot(id);

    await db.query(
      'UPDATE snapshots SET status = $1, updated_at = NOW() WHERE openstack_id = $2',
      ['deleted', id]
    );

    res.json({ message: 'Snapshot deletion initiated' });
  } catch (error) {
    logger.error('Failed to delete snapshot:', error);
    next(error);
  }
});

export default router;
