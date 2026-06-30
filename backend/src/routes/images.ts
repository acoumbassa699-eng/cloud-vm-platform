import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { glanceService } from '../../services/openstack/glance';
import { Pool } from 'pg';

const router = Router();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * @swagger
 * /api/v1/images:
 *   get:
 *     summary: List available images
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, status } = req.query;

    // Get images from OpenStack
    const images = await glanceService.searchImages(
      name as string,
      status as string
    );

    res.json({ images });
  } catch (error) {
    logger.error('Failed to list images:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/images/{id}:
 *   get:
 *     summary: Get image details
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const image = await glanceService.getImage(id);

    res.json({ image });
  } catch (error) {
    logger.error('Failed to get image:', error);
    next(error);
  }
});

export default router;
