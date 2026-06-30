import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { novaService } from '../../services/openstack/nova';
import { neutronService } from '../../services/openstack/neutron';
import { cinderService } from '../../services/openstack/cinder';
import { glanceService } from '../../services/openstack/glance';
import { validateRequest } from '../../middleware/validation';
import Joi from 'joi';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * @swagger
 * /api/v1/instances:
 *   get:
 *     summary: List all VM instances
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of instances
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    // Get instances from database
    const result = await db.query(
      'SELECT * FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const instances = result.rows.map((row: any) => ({
      id: row.openstack_id,
      name: row.name,
      status: row.status,
      vcpus: row.vcpus,
      ram: row.ram,
      disk: row.disk,
      created_at: row.created_at,
      project_id: row.project_id,
      ipAddress: row.ip_address
    }));

    res.json({ instances });
  } catch (error) {
    logger.error('Failed to list instances:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}:
 *   get:
 *     summary: Get instance details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Verify user owns this instance
    const result = await db.query(
      'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const instance = result.rows[0];

    // Get real-time data from OpenStack
    const vmData = await novaService.getVM(id);

    res.json({
      id: instance.openstack_id,
      name: instance.name,
      status: vmData.status,
      state: vmData.state,
      created: vmData.created,
      addresses: vmData.addresses,
      flavor: vmData.flavor,
      image: vmData.image,
      metadata: vmData.metadata,
      powerState: vmData.powerState,
      taskState: vmData.taskState,
      vcpus: instance.vcpus,
      ram: instance.ram,
      disk: instance.disk,
      project_id: instance.project_id
    });
  } catch (error) {
    logger.error('Failed to get instance:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/instances:
 *   post:
 *     summary: Create a new VM instance
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
 *               projectId:
 *                 type: string
 */
router.post(
  '/',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string().required(),
      imageId: Joi.string().required(),
      flavorId: Joi.string().required(),
      networkId: Joi.string().required(),
      projectId: Joi.string().required(),
      keyName: Joi.string(),
      securityGroups: Joi.array().items(Joi.string())
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { name, imageId, flavorId, networkId, projectId, keyName, securityGroups } = req.body;

      // Verify user owns this project
      const projectCheck = await db.query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Project not found' });
      }

      // Create VM in OpenStack
      const vmData = await novaService.createVM({
        name,
        imageId,
        flavorId,
        networkId,
        keyName,
        securityGroups: securityGroups || ['default'],
        metadata: {
          'project_id': projectId,
          'user_id': userId
        }
      });

      // Get flavor details for resource tracking
      const flavor = await novaService.getFlavor(flavorId);

      // Store instance in database
      const instanceId = uuidv4();
      await db.query(
        `INSERT INTO instances (id, user_id, project_id, openstack_id, name, status, vcpus, ram, disk, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [instanceId, userId, projectId, vmData.id, name, vmData.status, flavor.vcpus, flavor.ram, flavor.disk]
      );

      res.status(201).json({
        id: vmData.id,
        name: vmData.name,
        status: vmData.status,
        vcpus: flavor.vcpus,
        ram: flavor.ram,
        disk: flavor.disk
      });
    } catch (error) {
      logger.error('Failed to create instance:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/instances/{id}/reboot:
 *   post:
 *     summary: Reboot an instance
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reboot', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { type } = req.body;

    // Verify ownership
    const result = await db.query(
      'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    await novaService.rebootVM(id, type || 'SOFT');

    res.json({ message: 'Reboot initiated' });
  } catch (error) {
    logger.error('Failed to reboot instance:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}/start:
 *   post:
 *     summary: Start a stopped instance
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/start', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    await novaService.startVM(id);
    res.json({ message: 'Start initiated' });
  } catch (error) {
    logger.error('Failed to start instance:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}/stop:
 *   post:
 *     summary: Stop a running instance
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/stop', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    await novaService.stopVM(id);
    res.json({ message: 'Stop initiated' });
  } catch (error) {
    logger.error('Failed to stop instance:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/instances/{id}:
 *   delete:
 *     summary: Delete an instance
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM instances WHERE openstack_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    await novaService.deleteVM(id);

    // Mark as deleted in database
    await db.query(
      'UPDATE instances SET status = $1, updated_at = NOW() WHERE openstack_id = $2',
      ['deleted', id]
    );

    res.json({ message: 'Instance deletion initiated' });
  } catch (error) {
    logger.error('Failed to delete instance:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/instances/flavors:
 *   get:
 *     summary: List available VM flavors
 *     security:
 *       - bearerAuth: []
 */
router.get('/flavors/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flavors = await novaService.getFlavors();
    res.json({ flavors });
  } catch (error) {
    logger.error('Failed to list flavors:', error);
    next(error);
  }
});

export default router;
