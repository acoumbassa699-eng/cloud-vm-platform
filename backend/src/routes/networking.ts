import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { networkService } from '../../core/openstack/network';

const router = Router();

/**
 * @swagger
 * /api/v1/networking/routers:
 *   get:
 *     summary: List all routers
 */
router.get('/routers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const routers = await networkService.listRouters();
    res.json({ routers });
  } catch (error) { next(error); }
});

/**
 * @swagger
 * /api/v1/networking/networks:
 *   get:
 *     summary: List all networks
 */
router.get('/networks', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const networks = await networkService.listNetworks();
    res.json({ networks });
  } catch (error) { next(error); }
});

export default router;
