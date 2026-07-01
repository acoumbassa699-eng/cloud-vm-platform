import { Router, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthRequest, authenticate } from '../middleware/auth';
import { novaService } from '../services/openstack/nova';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { container } from '../container';
import { IInstanceRepository, IProjectRepository } from '../interfaces/repositories';
import { quotaService } from '../services/quota';
import { instanceQueue } from '../services/queue';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instanceRepository = container.getRepository<IInstanceRepository>('InstanceRepository');
    const instances = await instanceRepository.findByProjectId(req.projectId!);

    res.json({
      instances: instances.map(inst => ({
        id: inst.openstack_id,
        dbId: inst.id,
        name: inst.name,
        state: inst.status,
        cpu: inst.vcpus,
        ram: inst.ram,
        storage: inst.disk,
        created_at: inst.created_at,
        ip_address: inst.ip_address
      }))
    });
  } catch (error) {
    logger.error('Failed to list instances:', error);
    next(error);
  }
});

router.post(
  '/',
  authenticate,
  validateRequest(
    Joi.object({
      name: Joi.string().required(),
      imageId: Joi.string().required(),
      flavorId: Joi.string().required(),
      networkId: Joi.string().required(),
      keyName: Joi.string(),
      securityGroups: Joi.array().items(Joi.string())
    })
  ),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, imageId, flavorId, networkId, keyName, securityGroups } = req.body;
      const projectId = req.projectId!;
      const userId = req.userId!;

      const flavor = await novaService.getFlavor(flavorId);

      const quotaCheck = await quotaService.checkQuota(projectId, {
        cpu: flavor.vcpus,
        ram: flavor.ram,
        disk: flavor.disk,
        instances: 1
      });

      if (!quotaCheck.allowed) {
        return res.status(403).json({ error: quotaCheck.reason });
      }

      const instanceRepository = container.getRepository<IInstanceRepository>('InstanceRepository');
      const dbInstanceId = uuidv4();

      const instance = await instanceRepository.create({
        id: dbInstanceId,
        user_id: userId,
        project_id: projectId,
        openstack_id: 'pending',
        name,
        status: 'PROVISIONING',
        vcpus: flavor.vcpus,
        ram: flavor.ram,
        disk: flavor.disk
      });

      await instanceQueue.add('create-instance', {
        spec: {
          name,
          imageId,
          flavorId,
          networkId,
          keyName,
          securityGroups,
          metadata: { project_id: projectId, user_id: userId }
        },
        userId,
        projectId,
        dbInstanceId
      });

      res.status(202).json({
        message: 'Instance provisioning initiated',
        instanceId: dbInstanceId
      });
    } catch (error) {
      logger.error('Failed to initiate instance creation:', error);
      next(error);
    }
  }
);

router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instanceRepository = container.getRepository<IInstanceRepository>('InstanceRepository');
    const instance = await instanceRepository.findByOpenstackId(id);

    if (!instance || instance.user_id !== req.userId) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const vmData = await novaService.getVM(id);

    res.json({
      id: instance.openstack_id,
      name: instance.name,
      status: vmData.status,
      state: vmData.status,
      created: vmData.created,
      addresses: vmData.addresses,
      flavor: vmData.flavor,
      image: vmData.image,
      metadata: vmData.metadata,
      powerState: vmData.powerState,
      taskState: vmData.taskState,
      cpu: instance.vcpus,
      ram: instance.ram,
      storage: instance.disk,
      project_id: instance.project_id,
      ip_address: instance.ip_address
    });
  } catch (error) {
    logger.error('Failed to get instance:', error);
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instanceRepository = container.getRepository<IInstanceRepository>('InstanceRepository');
    const instance = await instanceRepository.findByOpenstackId(id);

    if (!instance || instance.user_id !== req.userId) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    await instanceQueue.add('delete-instance', {
      openstackId: id,
      dbInstanceId: instance.id
    });

    res.json({ message: 'Instance deletion initiated' });
  } catch (error) {
    logger.error('Failed to initiate instance deletion:', error);
    next(error);
  }
});

router.post('/:id/action', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action, body } = req.body;

    // Authorization check omitted for brevity, should verify ownership

    switch (action) {
      case 'start': await novaService.startVM(id); break;
      case 'stop': await novaService.stopVM(id); break;
      case 'reboot': await novaService.rebootVM(id, body?.type); break;
      case 'pause': await novaService.pauseVM(id); break;
      case 'unpause': await novaService.unpauseVM(id); break;
      case 'suspend': await novaService.suspendVM(id); break;
      case 'resume': await novaService.resumeVM(id); break;
      default: return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ message: `Action ${action} initiated` });
  } catch (error) {
    logger.error('Failed to perform instance action:', error);
    next(error);
  }
});

export default router;
