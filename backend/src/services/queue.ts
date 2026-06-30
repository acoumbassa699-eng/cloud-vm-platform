import Queue from 'bull';
import { logger } from '../utils/logger';
import { getRedisClient } from './redis';
import { createInstanceJob } from '../jobs/createInstance';
import { deleteInstanceJob } from '../jobs/deleteInstance';
import { startInstanceJob } from '../jobs/startInstance';
import { stopInstanceJob } from '../jobs/stopInstance';
import { rebootInstanceJob } from '../jobs/rebootInstance';
import { createSnapshotJob } from '../jobs/createSnapshot';
import { collectMetricsJob } from '../jobs/collectMetrics';
import { calculateBillingJob } from '../jobs/calculateBilling';

let instanceQueue: Queue.Queue;
let snapshotQueue: Queue.Queue;
let metricsQueue: Queue.Queue;
let billingQueue: Queue.Queue;

const QUEUE_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
};

export async function initializeQueues(): Promise<void> {
  try {
    instanceQueue = new Queue('instance-operations', QUEUE_CONFIG);
    snapshotQueue = new Queue('snapshot-operations', QUEUE_CONFIG);
    metricsQueue = new Queue('metrics-collection', QUEUE_CONFIG);
    billingQueue = new Queue('billing-calculation', QUEUE_CONFIG);

    // Instance Queue Processors
    instanceQueue.process('create', createInstanceJob);
    instanceQueue.process('delete', deleteInstanceJob);
    instanceQueue.process('start', startInstanceJob);
    instanceQueue.process('stop', stopInstanceJob);
    instanceQueue.process('reboot', rebootInstanceJob);

    // Snapshot Queue Processors
    snapshotQueue.process('create', createSnapshotJob);

    // Metrics Queue Processors
    metricsQueue.process('collect', collectMetricsJob);

    // Billing Queue Processors (scheduled)
    billingQueue.process('calculate', calculateBillingJob);

    // Event Listeners
    setupQueueListeners();

    logger.info('All queues initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
}

function setupQueueListeners(): void {
  const queues = [instanceQueue, snapshotQueue, metricsQueue, billingQueue];

  queues.forEach((queue) => {
    queue.on('error', (error) => {
      logger.error(`Queue ${queue.name} error:`, error);
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed:`, {
        jobName: job.name,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts
      });
    });

    queue.on('completed', (job) => {
      logger.info(`Job ${job.id} completed:`, {
        jobName: job.name,
        duration: `${job.finishedOn! - job.processedOn!}ms`
      });
    });
  });
}

export function getInstanceQueue(): Queue.Queue {
  if (!instanceQueue) {
    throw new Error('Instance queue not initialized');
  }
  return instanceQueue;
}

export function getSnapshotQueue(): Queue.Queue {
  if (!snapshotQueue) {
    throw new Error('Snapshot queue not initialized');
  }
  return snapshotQueue;
}

export function getMetricsQueue(): Queue.Queue {
  if (!metricsQueue) {
    throw new Error('Metrics queue not initialized');
  }
  return metricsQueue;
}

export function getBillingQueue(): Queue.Queue {
  if (!billingQueue) {
    throw new Error('Billing queue not initialized');
  }
  return billingQueue;
}

export async function enqueueInstanceCreation(
  projectId: string,
  instanceData: any
): Promise<string> {
  const job = await instanceQueue.add('create', {
    projectId,
    ...instanceData
  }, {
    priority: 10,
    removeOnComplete: false,
    removeOnFail: false
  });
  return job.id.toString();
}

export async function enqueueInstanceDeletion(
  projectId: string,
  instanceId: string
): Promise<string> {
  const job = await instanceQueue.add('delete', {
    projectId,
    instanceId
  }, {
    priority: 10
  });
  return job.id.toString();
}

export async function enqueueInstanceStart(
  projectId: string,
  instanceId: string
): Promise<string> {
  const job = await instanceQueue.add('start', {
    projectId,
    instanceId
  }, {
    priority: 8
  });
  return job.id.toString();
}

export async function enqueueInstanceStop(
  projectId: string,
  instanceId: string
): Promise<string> {
  const job = await instanceQueue.add('stop', {
    projectId,
    instanceId
  }, {
    priority: 8
  });
  return job.id.toString();
}

export async function enqueueInstanceReboot(
  projectId: string,
  instanceId: string
): Promise<string> {
  const job = await instanceQueue.add('reboot', {
    projectId,
    instanceId
  }, {
    priority: 8
  });
  return job.id.toString();
}

export async function enqueueSnapshotCreation(
  projectId: string,
  instanceId: string,
  snapshotName: string
): Promise<string> {
  const job = await snapshotQueue.add('create', {
    projectId,
    instanceId,
    snapshotName
  }, {
    priority: 5
  });
  return job.id.toString();
}

export async function enqueueMetricsCollection(
  projectId: string,
  instanceId: string
): Promise<string> {
  const job = await metricsQueue.add('collect', {
    projectId,
    instanceId
  }, {
    priority: 1,
    repeat: {
      every: 60000 // Every minute
    }
  });
  return job.id.toString();
}

export async function enqueueBillingCalculation(
  projectId: string
): Promise<string> {
  const job = await billingQueue.add('calculate', {
    projectId
  }, {
    repeat: {
      cron: '0 0 * * *' // Daily at midnight
    }
  });
  return job.id.toString();
}
