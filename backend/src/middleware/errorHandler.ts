import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // Handle specific error types
  if (err.message.includes('Unexpected token')) {
    return res.status(400).json({
      error: 'Invalid JSON in request body'
    });
  }

  res.status(500).json({
    error: 'Internal server error'
  });
}
