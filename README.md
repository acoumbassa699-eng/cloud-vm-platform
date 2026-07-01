# Cloud VM Platform

Production-ready Cloud VM platform with deep OpenStack integration.

## Features
- **VM Orchestration**: Full lifecycle management (Start, Stop, Reboot, Delete, Provision).
- **Networking**: Dynamic network and security group management.
- **Storage**: Persistent volumes and snapshots.
- **Monitoring**: Real-time VM status and historical metrics.
- **Multi-tenancy**: Keystone-based authentication and multi-project support.

## Architecture
See [DOCS.md](./DOCS.md) for detailed architectural information.

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL
- Redis
- OpenStack Access (Keystone v3)

### Environment Variables
```env
DATABASE_URL=postgres://user:pass@localhost:5432/cloudvm
REDIS_URL=redis://localhost:6379
OPENSTACK_AUTH_URL=https://openstack.example.com:5000/v3
OPENSTACK_USERNAME=admin
OPENSTACK_PASSWORD=secret
OPENSTACK_PROJECT_NAME=admin
OPENSTACK_DOMAIN=Default
OPENSTACK_REGION=RegionOne
```

### Installation
```bash
cd backend
npm install
npm run migrate
npm run dev
```

## Testing
```bash
cd backend
npm test
```
