import { Router, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthRequest, authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: List all projects for user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, description, quota_cpu, quota_ram, quota_storage, quota_instances, status, created_at
       FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json({
      success: true,
      projects: result.rows
    });
  } catch (error) {
    logger.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get project details with usage
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
 *         description: Project details
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const projectResult = await query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get usage statistics
    const usageResult = await query(
      `SELECT 
        COALESCE(SUM(cpu), 0) as used_cpu,
        COALESCE(SUM(ram), 0) as used_ram,
        COALESCE(SUM(storage), 0) as used_storage,
        COUNT(*) as instance_count
       FROM instances WHERE project_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    const project = projectResult.rows[0];
    const usage = usageResult.rows[0];

    res.json({
      success: true,
      project: {
        ...project,
        usage: {
          cpu: usage.used_cpu,
          ram: usage.used_ram,
          storage: usage.used_storage,
          instances: usage.instance_count
        }
      }
    });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

export default router;
