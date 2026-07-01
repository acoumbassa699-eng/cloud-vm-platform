import Queue from 'bull';
import { logger } from '../utils/logger';
import { novaService } from './openstack/nova';
import { container } from '../container';
import { IInstanceRepository } from '../interfaces/repositories';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

export const instanceQueue = new Queue('instance-operations', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true
  }
});

export function initializeQueues() {
  const instanceRepository = container.getRepository<IInstanceRepository>('InstanceRepository');

  instanceQueue.process('create-instance', async (job) => {
    const { spec, userId, projectId, dbInstanceId } = job.data;
    logger.info(`Processing create-instance job: ${job.id}`);

    try {
      const vmData = await novaService.createVM(spec);

      await instanceRepository.update(dbInstanceId, {
        openstack_id: vmData.id,
        status: vmData.status
      });

      return { openstackId: vmData.id };
    } catch (error) {
      logger.error(`Failed to create instance for job ${job.id}:`, error);
      throw error;
    }
  });

  instanceQueue.process('delete-instance', async (job) => {
    const { openstackId, dbInstanceId } = job.data;
    logger.info(`Processing delete-instance job: ${job.id}`);

    try {
      await novaService.deleteVM(openstackId);
      await instanceRepository.update(dbInstanceId, {
        status: 'DELETED',
        deleted_at: new Date()
      });
    } catch (error) {
      logger.error(`Failed to delete instance for job ${job.id}:`, error);
      throw error;
    }
  });

  instanceQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed: ${err.message}`);
  });

  logger.info('Bull queues initialized');
}
