import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';
import { setCache, getCache } from '../services/redis';

const router = Router();

interface LoginRequest {
  email: string;
  password: string;
}

interface TokenPayload {
  userId: string;
  projectId: string;
  role: string;
  email: string;
}

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'INVALID_INPUT'
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // Create user
    const userId = uuid();
    const result = await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, email, first_name, last_name, role`,
      [userId, email, passwordHash, firstName || '', lastName || '', 'user', 'active']
    );

    // Create default project
    const projectId = uuid();
    await query(
      `INSERT INTO projects (id, user_id, name, description, quota_cpu, quota_ram, quota_storage, quota_instances, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [projectId, userId, 'Default Project', 'Default project for user', 10, 50, 500, 20, 'active']
    );

    logger.info(`User registered: ${userId}`);

    res.status(201).json({
      success: true,
      user: result.rows[0],
      projectId
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'INVALID_INPUT'
      });
    }

    // Get user
    const userResult = await query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Get user's first project
    const projectResult = await query(
      'SELECT id FROM projects WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    const projectId = projectResult.rows[0]?.id || uuid();

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        projectId,
        role: user.role,
        email: user.email
      } as TokenPayload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    // Create refresh token
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.REFRESH_TOKEN_SECRET || 'refresh-secret',
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
    );

    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Store refresh token in cache
    await setCache(`refresh-token:${user.id}`, refreshToken, 30 * 24 * 60 * 60);

    logger.info(`User logged in: ${user.id}`);

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      projectId
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh authentication token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET || 'refresh-secret'
      );
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_TOKEN'
      });
    }

    // Get user
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];

    // Get user's project
    const projectResult = await query(
      'SELECT id FROM projects WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    const projectId = projectResult.rows[0]?.id || uuid();

    // Create new JWT token
    const newToken = jwt.sign(
      {
        userId: user.id,
        projectId,
        role: user.role,
        email: user.email
      } as TokenPayload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Unauthorized
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as TokenPayload;

    const userResult = await query(
      'SELECT id, email, first_name, last_name, role, status, created_at, last_login FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: userResult.rows[0]
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      code: 'GET_USER_ERROR'
    });
  }
});

export default router;
