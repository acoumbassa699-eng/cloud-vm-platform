import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

interface UseWebSocketOptions {
  projectId?: string;
  onInstanceStatusChange?: (data: any) => void;
  onInstanceUpdate?: (data: any) => void;
  onVolumeUpdate?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Subscribe to project updates if specified
      if (options.projectId) {
        socket.emit('subscribe:project', options.projectId);
      }
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('instance:status_changed', (data) => {
      console.log('Instance status changed:', data);
      options.onInstanceStatusChange?.(data);
    });

    socket.on('instance:updated', (data) => {
      console.log('Instance updated:', data);
      options.onInstanceUpdate?.(data);
    });

    socket.on('volume:updated', (data) => {
      console.log('Volume updated:', data);
      options.onVolumeUpdate?.(data);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setError(error.message);
      options.onError?.(error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, options.projectId]);

  const refreshInstance = (instanceId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('instance:refresh', instanceId);
    }
  };

  const refreshVolume = (volumeId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('volume:refresh', volumeId);
    }
  };

  return {
    isConnected,
    error,
    refreshInstance,
    refreshVolume
  };
}
