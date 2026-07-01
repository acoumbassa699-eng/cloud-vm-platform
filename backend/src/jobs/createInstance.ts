import { Job } from 'bull';
import { instanceRepository } from '../repositories/instance.repository';
import { computeService } from '../core/openstack/compute';
import { storageService } from '../core/openstack/storage';
import { quotaService } from '../core/openstack/quotas';
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
  userData?: string;
}

export async function createInstanceJob(
  job: Job<CreateInstanceJobData>
): Promise<any> {
  const { projectId, instanceId, name, imageId, flavorId, networkId, cpu, ram, storage, keypairName, securityGroups, metadata, userData } = job.data;
  let createdServerId: string | null = null;
  let createdVolumeId: string | null = null;

  try {
    const quotaCheck = await quotaService.validateProvisioning(projectId, { vcpus: cpu, ram, instances: 1, gigabytes: storage, volumes: 1 });
    if (!quotaCheck.valid) throw new Error(`Quota validation failed: ${quotaCheck.errors.join(', ')}`);

    const existing = await instanceRepository.findById(instanceId);
    if (existing?.provider_id && existing.state === 'RUNNING') return { success: true, instanceId: existing.provider_id };

    await instanceRepository.update(instanceId, { state: 'CREATING' });

    const volume = await storageService.createVolume({ name: `vol-${name}`, size: storage, imageRef: imageId, metadata: { 'instance_id': instanceId } });
    createdVolumeId = volume.id;

    let volReady = false;
    for (let i = 0; i < 30; i++) {
      const v = await storageService.getVolume(createdVolumeId!);
      if (v.status === 'available') { volReady = true; break; }
      if (v.status === 'error') throw new Error('Volume creation failed');
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!volReady) throw new Error('Volume creation timed out');

    const server = await computeService.createServer({
      name, imageRef: '', flavorRef: flavorId, networks: [{ uuid: networkId }], key_name: keypairName,
      security_groups: securityGroups?.map(sg => ({ name: sg })),
      user_data: userData ? Buffer.from(userData).toString('base64') : undefined,
      metadata: { ...metadata, 'instance_id': instanceId, 'project_id': projectId }
    });
    createdServerId = server.id;

    let isReady = false;
    for (let i = 0; i < 60; i++) {
      const current = await computeService.getServer(createdServerId!);
      if (current.status === 'ACTIVE') { isReady = true; break; }
      if (current.status === 'ERROR') throw new Error('Instance entered ERROR state');
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!isReady) throw new Error('Instance creation timed out');

    const finalServer = await computeService.getServer(createdServerId!);
    const ipAddress = finalServer.addresses?.default?.[0]?.addr || null;

    await instanceRepository.update(instanceId, { state: 'RUNNING', provider_id: createdServerId!, ip_address: ipAddress || undefined });
    await deleteCache(`nova:instance:${createdServerId}`);

    return { success: true, instanceId: createdServerId, ipAddress };
  } catch (error: any) {
    logger.error(`Provisioning failed for ${instanceId}: ${error.message}`);
    if (createdServerId) { try { await computeService.deleteServer(createdServerId); } catch (e: any) { logger.warn(`Rollback delete server failed: ${e.message}`); } }
    if (createdVolumeId) { await new Promise(r => setTimeout(r, 5000)); try { await storageService.deleteVolume(createdVolumeId); } catch (e: any) { logger.warn(`Rollback delete volume failed: ${e.message}`); } }
    await instanceRepository.update(instanceId, { state: 'ERROR' });
    throw error;
  }
}
