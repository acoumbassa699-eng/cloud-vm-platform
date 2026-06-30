import { Router, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { AuthRequest, authenticateJWT, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List all users (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Forbidden
 */
router.get('/users', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, status, created_at, last_login
       FROM users ORDER BY created_at DESC LIMIT 100`,
      []
    );

    res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    logger.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * @swagger
 * /api/v1/admin/instances:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List all instances (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all instances
 */
router.get('/instances', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT i.id, i.name, i.state, i.cpu, i.ram, i.storage, i.created_at, p.id as project_id
       FROM instances i
       JOIN projects p ON i.project_id = p.id
       WHERE i.deleted_at IS NULL
       ORDER BY i.created_at DESC LIMIT 200`,
      []
    );

    res.json({
      success: true,
      instances: result.rows
    });
  } catch (error) {
    logger.error('List all instances error:', error);
    res.status(500).json({ error: 'Failed to list instances' });
  }
});

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get audit logs (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit logs
 */
router.get('/audit-logs', authorize('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, user_id, action, resource_type, resource_id, ip_address, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 1000`,
      []
    );

    res.json({
      success: true,
      logs: result.rows
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

export default router;
