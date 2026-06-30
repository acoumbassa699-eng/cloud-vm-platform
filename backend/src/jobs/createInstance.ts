import { Job } from 'bull';
import { query } from '../database/connection';
import { novaClient } from '../services/nova';
import { neutronClient } from '../services/neutron';
import { cinderClient } from '../services/cinder';
import { logger } from '../utils/logger';
import { deleteCache } from '../services/redis';

interface CreateInstanceJobData {
  projectId: string;
  instanceId: string;
  name: string;
  imageId: string;
  flavorId: string;
  networkId: string;
  cpu: number;
  ram: number;
  storage: number;
  keypairName?: string;
  securityGroups?: string[];
  metadata?: Record<string, string>;
}

export async function createInstanceJob(
  job: Job<CreateInstanceJobData>
): Promise<any> {
  const { projectId, instanceId, name, imageId, flavorId, networkId, cpu, ram, storage, keypairName, securityGroups, metadata } = job.data;

  try {
    logger.info(`Creating instance: ${instanceId}`, job.data);

    // Update instance state to CREATING
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['CREATING', instanceId]
    );

    // Create instance in Nova
    const novaInstance = await novaClient.createInstance({
      name,
      imageId,
      flavorId,
      networkId,
      keypairName,
      securityGroups,
      metadata: {
        ...metadata,
        'instance-id': instanceId,
        'project-id': projectId
      }
    });

    logger.info(`Nova instance created: ${novaInstance.id}`);

    // Create volume for root disk
    const volume = await cinderClient.createVolume({
      name: `vol-${name}`,
      size: storage,
      description: `Root volume for ${name}`
    });

    logger.info(`Volume created: ${volume.id}`);

    // Poll for instance to be in ACTIVE state
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (!isReady && attempts < maxAttempts) {
      const currentInstance = await novaClient.getInstance(novaInstance.id);
      
      if (currentInstance.status === 'ACTIVE') {
        isReady = true;
      } else if (currentInstance.status === 'ERROR') {
        throw new Error(`Instance creation failed: ${currentInstance['fault']?.message || 'Unknown error'}`);
      }

      if (!isReady) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    if (!isReady) {
      throw new Error('Instance creation timeout');
    }

    // Get instance details
    const finalInstance = await novaClient.getInstance(novaInstance.id);
    const ipAddress = finalInstance.addresses?.default?.[0]?.addr || null;

    // Update instance in database
    await query(
      `UPDATE instances SET 
        state = $1, 
        provider_id = $2, 
        ip_address = $3, 
        updated_at = NOW() 
       WHERE id = $4`,
      ['RUNNING', novaInstance.id, ipAddress, instanceId]
    );

    logger.info(`Instance created successfully: ${instanceId} (Nova ID: ${novaInstance.id})`);

    await deleteCache(`nova:instance:${novaInstance.id}`);

    return {
      success: true,
      instanceId: novaInstance.id,
      ipAddress,
      status: 'RUNNING'
    };
  } catch (error) {
    logger.error(`Failed to create instance ${instanceId}:`, error);

    // Update instance state to ERROR
    await query(
      `UPDATE instances SET state = $1, updated_at = NOW() WHERE id = $2`,
      ['ERROR', instanceId]
    );

    throw error;
  }
}
