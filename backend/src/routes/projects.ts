import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { validateRequest } from '../middleware/validation';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: List user projects
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;

    const result = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const projects = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    res.json({ projects });
  } catch (error) {
    logger.error('Failed to list projects:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create a new project
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string().required(),
      description: Joi.string()
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { name, description } = req.body;

      const projectId = uuidv4();

      await db.query(
        `INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [projectId, userId, name, description || '']
      );

      res.status(201).json({
        id: projectId,
        name,
        description,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to create project:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get project details
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = result.rows[0];

    // Get project stats
    const statsResult = await db.query(
      `SELECT 
        COUNT(i.id) as instance_count,
        SUM(i.vcpus) as total_vcpus,
        SUM(i.ram) as total_ram,
        SUM(i.disk) as total_disk,
        SUM(CASE WHEN i.status = 'ACTIVE' THEN 1 ELSE 0 END) as running_instances
       FROM instances i
       WHERE i.project_id = $1`,
      [id]
    );

    const stats = statsResult.rows[0];

    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
      stats: {
        instances: stats.instance_count || 0,
        vcpus: stats.total_vcpus || 0,
        ram_gb: stats.total_ram || 0,
        disk_gb: stats.total_disk || 0,
        running_instances: stats.running_instances || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get project:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: Update project
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string(),
      description: Joi.string()
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { name, description } = req.body;

      // Verify ownership
      const check = await db.query(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await db.query(
        'UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3',
        [name, description, id]
      );

      res.json({ message: 'Project updated' });
    } catch (error) {
      logger.error('Failed to update project:', error);
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    // Verify ownership
    const check = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Soft delete
    await db.query(
      'UPDATE projects SET deleted_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: 'Project deleted' });
  } catch (error) {
    logger.error('Failed to delete project:', error);
    next(error);
  }
});

export default router;
