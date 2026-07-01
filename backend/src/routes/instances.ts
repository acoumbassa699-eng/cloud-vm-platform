import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { authenticate } from '../../middleware/auth';
import { computeService } from '../../core/openstack/compute';
import { quotaService } from '../../core/openstack/quotas';
import { validateRequest } from '../../middleware/validation';
import { provisioningSchema } from '../../middleware/schemas';
import { enqueueInstanceCreation, enqueueInstanceDeletion, enqueueInstanceStart, enqueueInstanceStop, enqueueInstanceReboot } from '../../services/queue';
import { instanceRepository } from '../../repositories/instance.repository';
import { query } from '../../database/connection';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const instances = await instanceRepository.findByUserId(userId);
    res.json({ instances });
  } catch (error) { next(error); }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const instance = await instanceRepository.findById(id);
    if (!instance || instance.user_id !== userId) return res.status(404).json({ error: 'Instance not found' });

    let liveData = null;
    if (instance.provider_id) {
      try { liveData = await computeService.getServer(instance.provider_id); } catch (e) {}
    }
    res.json({ ...instance, liveData });
  } catch (error) { next(error); }
});

router.post('/', authenticate, validateRequest(provisioningSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { name, imageId, flavorId, networkId, projectId, keyName, securityGroups, storage, userData, metadata } = req.body;

    const projectCheck = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    if (projectCheck.rows.length === 0) return res.status(403).json({ error: 'Project access denied' });

    const flavor = await computeService.getFlavor(flavorId);
    const quotaCheck = await quotaService.validateProvisioning(projectId, { vcpus: flavor.vcpus, ram: flavor.ram, instances: 1, gigabytes: storage || 20, volumes: 1 });
    if (!quotaCheck.valid) return res.status(400).json({ error: 'Quota exceeded', details: quotaCheck.errors });

    const instanceId = uuidv4();
    const instance = await instanceRepository.create({
      id: instanceId, user_id: userId, project_id: projectId, name, state: 'PENDING',
      vcpus: flavor.vcpus, ram: flavor.ram, disk: storage || flavor.disk
    });

    const jobId = await enqueueInstanceCreation(projectId, {
      instanceId, name, imageId, flavorId, networkId, cpu: flavor.vcpus, ram: flavor.ram, storage: storage || flavor.disk,
      keypairName: keyName, securityGroups, userData, metadata
    });

    res.status(202).json({ id: instanceId, jobId, message: 'Provisioning started' });
  } catch (error) { next(error); }
});

router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const instance = await instanceRepository.findById(id);
    if (!instance || instance.user_id !== userId) return res.status(404).json({ error: 'Instance not found' });

    await enqueueInstanceDeletion(instance.project_id, id);
    res.json({ message: 'Deletion job enqueued' });
  } catch (error) { next(error); }
});

export default router;
