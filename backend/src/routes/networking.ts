import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { neutronService } from '../services/openstack/neutron';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * @swagger
 * /api/v1/networks:
 *   get:
 *     summary: List all networks
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM networks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const networks = result.rows.map((row: any) => ({
      id: row.openstack_id,
      name: row.name,
      status: row.status,
      cidr: row.cidr,
      created_at: row.created_at,
      project_id: row.project_id
    }));

    res.json({ networks });
  } catch (error) {
    logger.error('Failed to list networks:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/networks:
 *   post:
 *     summary: Create a new network
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string().required(),
      projectId: Joi.string().required()
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { name, projectId } = req.body;

      // Verify ownership
      const projectCheck = await db.query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Project not found' });
      }

      // Create network in OpenStack
      const networkData = await neutronService.createNetwork(name);

      // Store in database
      const networkId = uuidv4();
      await db.query(
        `INSERT INTO networks (id, user_id, project_id, openstack_id, name, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [networkId, userId, projectId, networkData.id, name, networkData.status]
      );

      res.status(201).json({
        id: networkData.id,
        name: networkData.name,
        status: networkData.status
      });
    } catch (error) {
      logger.error('Failed to create network:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/security-groups:
 *   get:
 *     summary: List security groups
 *     security:
 *       - bearerAuth: []
 */
router.get('/security-groups', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM security_groups WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const groups = result.rows.map((row: any) => ({
      id: row.openstack_id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      project_id: row.project_id
    }));

    res.json({ security_groups: groups });
  } catch (error) {
    logger.error('Failed to list security groups:', error);
    next(error);
  }
});

export default router;
