import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  projectId?: string;
  role?: string;
  token?: string;
}

export function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'No token provided',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    req.userId = decoded.userId;
    req.projectId = decoded.projectId;
    req.role = decoded.role;
    req.token = token;
    next();
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return res.status(403).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'FORBIDDEN',
        requiredRoles: roles
      });
    }
    next();
  };
}
