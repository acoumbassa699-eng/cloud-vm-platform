# Cloud VM Platform - OpenStack Integration

This project provides a robust, production-ready integration layer for OpenStack, enabling management of virtual machines, networking, and storage.

## Architecture

The backend follows SOLID principles and uses the following patterns:

- **Repository Pattern**: Data access logic is encapsulated in repositories (`src/repositories`), decoupling the application from the database schema.
- **Dependency Injection**: A simple DI container (`src/container`) manages service and repository instances, facilitating testing and modularity.
- **Job Queues**: Long-running operations like VM provisioning are handled asynchronously using Bull and Redis, ensuring reliability and scalability.
- **Service Layer**: OpenStack integration is organized into modular services (`src/services/openstack`) for Nova, Neutron, Cinder, Glance, and Keystone.

## Core Features

### Nova (Compute)
- Full VM lifecycle management (Start, Stop, Reboot, Pause, Suspend, Resume).
- VM resizing and rebuild.
- Console output and VNC console access.

### Neutron (Networking)
- Private network and subnet management.
- Router and floating IP support.
- Security group and rule management.

### Cinder (Block Storage)
- Volume creation and management.
- Volume snapshots and extension.

### Glance (Images)
- Image search and management.

### Quotas
- Real-time resource usage tracking and validation against project limits.

## Orchestration Flow

1. User requests VM creation via REST API.
2. `QuotaService` validates availability of resources.
3. A pending record is created in the database.
4. A `create-instance` job is added to the Bull queue.
5. The queue worker executes the orchestration flow:
   - Authenticate with Keystone.
   - Request VM creation from Nova.
   - Update database with real-time status.
6. Progress is tracked and errors are handled with exponential backoff.

## API Documentation

Swagger documentation is available at `/api-docs`.

## Integration

To connect to a real OpenStack deployment, configure the following environment variables:

- `OPENSTACK_AUTH_URL`: Keystone v3 endpoint.
- `OPENSTACK_USERNAME`: Service account username.
- `OPENSTACK_PASSWORD`: Service account password.
- `OPENSTACK_PROJECT`: Default project name.
- `REDIS_HOST`: Host for Bull queue management.
- `DATABASE_URL`: PostgreSQL connection string.
