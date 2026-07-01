# OpenStack Integration Architecture

## Overview
This platform integrates with OpenStack to provide Cloud VM capabilities. The integration layer is designed for production reliability, using TypeScript, SOLID principles, and an asynchronous orchestration flow.

## Core Services (`backend/src/core/openstack/`)
- **AuthService**: Handles Keystone v3 authentication, token lifecycle (caching in Redis), and service discovery.
- **ComputeService**: Wraps Nova API for VM lifecycle management (create, delete, start, stop, etc.).
- **NetworkService**: Wraps Neutron API for virtual networks, security groups, and floating IPs.
- **StorageService**: Wraps Cinder API for volume and snapshot management.
- **ImageService**: Wraps Glance API for image discovery.
- **QuotaService**: Proactively validates resource availability before provisioning.

## Orchestration Flow
1. **User Request**: User calls `POST /api/v1/instances`.
2. **Pre-validation**: API validates request schema and performs proactive quota checks.
3. **Database**: A record is created in the `instances` table with state `PENDING`.
4. **Queue**: A job is enqueued in Bull (Redis-backed).
5. **Worker**: `createInstanceJob` picks up the task:
   - Re-validates quotas.
   - Creates a bootable Cinder volume.
   - Creates a Nova server using that volume.
   - Polls OpenStack until the VM is `ACTIVE`.
   - Updates the DB with the provider ID and IP address.
   - **Rollback**: If any step fails, partially created resources (server/volume) are deleted.
   - **Idempotency**: The job checks if resources already exist before attempting creation.

## Reliability
- **Retries**: Bull is configured with exponential backoff for OpenStack operations.
- **Circuit Breaker Pattern**: Timeouts and error handling prevent cascading failures.
- **Atomic Operations**: State transitions in the DB track the lifecycle accurately.

## Monitoring
- **Jobs**: `collectMetricsJob` runs periodically to sync basic VM info.
- **WebSockets**: Real-time status updates are pushed to clients via Socket.IO.
