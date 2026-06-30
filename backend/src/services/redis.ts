import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

export async function initializeRedis(): Promise<void> {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => logger.error('Redis error:', err));
    redisClient.on('connect', () => logger.info('Redis connected'));

    await redisClient.connect();
  } catch (error) {
    logger.error('Redis initialization failed:', error);
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized');
  }
  return redisClient;
}

export async function setCache(
  key: string,
  value: any,
  ttl: number = 3600
): Promise<void> {
  await redisClient.setEx(key, ttl, JSON.stringify(value));
}

export async function getCache(key: string): Promise<any | null> {
  const value = await redisClient.get(key);
  return value ? JSON.parse(value) : null;
}

export async function deleteCache(key: string): Promise<void> {
  await redisClient.del(key);
}

export async function flushCache(): Promise<void> {
  await redisClient.flushDb();
}
