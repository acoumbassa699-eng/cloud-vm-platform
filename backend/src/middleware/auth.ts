import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  email?: string;
  role?: string;
  projectId?: string;
}

export async function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyToken(token);
      req.userId = (decoded as any).userId;
      req.email = (decoded as any).email;
      req.role = (decoded as any).role;
      req.projectId = (decoded as any).projectId;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export const authenticate = authenticateJWT;

export function authorize(roles: string | string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role) {
      return res.status(403).json({ error: 'No role assigned' });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    next();
  };
}
