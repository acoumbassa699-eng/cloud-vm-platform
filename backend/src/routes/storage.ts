import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { storageService } from '../../core/openstack/storage';
import { validateRequest } from '../../middleware/validation';
import { volumeSchema } from '../../middleware/schemas';

const router = Router();

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
    const volumes = await storageService.listVolumes();
    res.json({ volumes });
  } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/storage/volumes:
 *   post:
 *     summary: Create a new volume
 */
router.post('/volumes', authenticate, validateRequest(volumeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const volume = await storageService.createVolume(req.body);
    res.status(201).json({ volume });
  } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/storage/backups:
 *   get:
 *     summary: List all backups
 */
router.get('/backups', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backups = await storageService.listBackups();
    res.json({ backups });
  } catch (error) { next(error); }
});

export default router;
