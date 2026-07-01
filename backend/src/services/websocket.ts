import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { logger } from '../utils/logger';
import { verifyToken } from '../utils/jwt';
import { novaService } from './openstack/nova';
import { cinderService } from './openstack/cinder';
import { query } from '../database/connection';

interface ConnectedUser {
  userId: string;
  socketId: string;
  room: string;
}

const connectedUsers: Map<string, ConnectedUser> = new Map();
const instanceMonitoring: Map<string, NodeJS.Timeout> = new Map();

export function initializeWebSocket(app: express.Express) {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = verifyToken(token);
      (socket as any).userId = (decoded as any).userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    logger.info(`User connected: ${userId} (${socket.id})`);

    // Join personal room
    socket.join(`user:${userId}`);

    // Handle project subscription
    socket.on('subscribe:project', async (projectId: string) => {
      try {
        // Verify user owns project
        const projectCheck = await query(
          'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
          [projectId, userId]
        );

        if (projectCheck.rows.length === 0) {
          socket.emit('error', { message: 'Project not found' });
          return;
        }

        socket.join(`project:${projectId}`);
        socket.emit('subscribed', { projectId });
        logger.info(`User ${userId} subscribed to project ${projectId}`);

        // Start monitoring instances in this project
        startInstanceMonitoring(io, projectId, userId);
      } catch (error) {
        logger.error('Subscription error:', error);
        socket.emit('error', { message: 'Subscription failed' });
      }
    });

    // Handle instance updates
    socket.on('instance:refresh', async (instanceId: string) => {
      try {
        const vmData = await novaService.getVM(instanceId);
        socket.emit('instance:updated', vmData);
      } catch (error) {
        logger.error('Failed to refresh instance:', error);
        socket.emit('error', { message: 'Failed to refresh instance' });
      }
    });

    // Handle volume updates
    socket.on('volume:refresh', async (volumeId: string) => {
      try {
        const volumeData = await cinderService.getVolume(volumeId);
        socket.emit('volume:updated', volumeData);
      } catch (error) {
        logger.error('Failed to refresh volume:', error);
        socket.emit('error', { message: 'Failed to refresh volume' });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userId} (${socket.id})`);
      connectedUsers.delete(socket.id);
    });
  });

  return httpServer;
}

function startInstanceMonitoring(io: SocketIOServer, projectId: string, userId: string) {
  const monitoringKey = `project:${projectId}`;

  // Skip if already monitoring
  if (instanceMonitoring.has(monitoringKey)) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      // Get instances for this project
      const result = await query(
        'SELECT openstack_id, status FROM instances WHERE project_id = $1',
        [projectId]
      );

      for (const row of result.rows) {
        try {
          const vmData = await novaService.getVM(row.openstack_id);

          // Check if status changed
          if (vmData.status !== row.status) {
            // Update database
            await query(
              'UPDATE instances SET status = $1, updated_at = NOW() WHERE openstack_id = $2',
              [vmData.status, row.openstack_id]
            );

            // Emit update to all subscribed users
            io.to(`project:${projectId}`).emit('instance:status_changed', {
              instanceId: row.openstack_id,
              status: vmData.status,
              powerState: vmData.powerState,
              taskState: vmData.taskState,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          logger.error(`Failed to monitor instance ${row.openstack_id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Instance monitoring error:', error);
    }
  }, 30000); // Check every 30 seconds

  instanceMonitoring.set(monitoringKey, interval);
}

export function stopInstanceMonitoring(projectId: string) {
  const monitoringKey = `project:${projectId}`;
  const interval = instanceMonitoring.get(monitoringKey);
  if (interval) {
    clearInterval(interval);
    instanceMonitoring.delete(monitoringKey);
  }
}
