import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { logger } from './logger';

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_SECRET: Secret = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_key';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

interface TokenPayload {
  userId: string;
  email: string;
  role?: string;
  projectId?: string;
}

export function generateToken(payload: TokenPayload): string {
  try {
    const options: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as any
    };
    return jwt.sign(payload, JWT_SECRET, options);
  } catch (error) {
    logger.error('Failed to generate token:', error);
    throw error;
  }
}

export function generateRefreshToken(payload: TokenPayload): string {
  try {
    const options: SignOptions = {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN as any
    };
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, options);
  } catch (error) {
    logger.error('Failed to generate refresh token:', error);
    throw error;
  }
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    logger.error('Token verification failed:', error);
    throw error;
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    logger.error('Refresh token verification failed:', error);
    throw error;
  }
}
