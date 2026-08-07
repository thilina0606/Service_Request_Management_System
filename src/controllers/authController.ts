import { Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/db';
import { config } from '../config/config';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail } from '../services/email';

export async function register(req: AuthenticatedRequest, res: Response) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields (name, email, password) are required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  // Determine user role (Default is 'User' if not specified or invalid)
  let userRole: 'User' | 'Inventory Officer' | 'Admin' = 'User';
  if (role === 'Admin' || role === 'admin') {
    userRole = 'Admin';
  } else if (role === 'Inventory Officer' || role === 'Inventory' || role === 'inventory' || role === 'Officer') {
    userRole = 'Inventory Officer';
  } else if (role === 'User' || role === 'user' || role === 'Requester') {
    userRole = 'User';
  }

  try {
    const existing = db.findUserByEmail(trimmedEmail);
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const salt = bcryptjs.genSaltSync(10);
    const passwordHash = bcryptjs.hashSync(password, salt);

    const newUser = db.createUser({
      name: name.trim(),
      email: trimmedEmail,
      password: passwordHash,
      role: userRole
    });

    // Create JWT
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error during registration' });
  }
}

export async function login(req: AuthenticatedRequest, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = bcryptjs.compareSync(password, user.password || '');
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error during login' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const user = db.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    }
  });
}

/**
 * POST /api/auth/forgot-password
 * Initiates password reset by generating a 6-digit code and emailing the user
 */
export async function forgotPassword(req: AuthenticatedRequest, res: Response) {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Email is required' });
  }

  const trimmedEmail = email.trim().toLowerCase();

  try {
    const user = db.findUserByEmail(trimmedEmail);

    if (user) {
      // Generate a 6-digit numeric reset token
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      // Valid for 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      db.setResetToken(user.email, resetToken, expiresAt);

      // Log activity
      db.createActivityLog({
        request_id: 'SYSTEM',
        action: 'Password Reset Request',
        performed_by: user.name,
        role: user.role,
        description: `Requested password reset code for email: ${user.email}`
      });

      // Dispatch password reset email (will log to Mailtrap Outbox)
      sendPasswordResetEmail(user, resetToken).catch(err => {
        console.error('Failed to send password reset email:', err);
      });
    }

    // Always return a positive generic response to prevent email enumeration
    return res.status(200).json({
      message: 'If an account exists for this email address, a 6-digit password reset code has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Internal server error during password reset request' });
  }
}

/**
 * POST /api/auth/reset-password
 * Resets user password using the 6-digit token
 */
export async function resetPassword(req: AuthenticatedRequest, res: Response) {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'Email, reset token, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedToken = token.trim();

  try {
    const user = db.findUserByEmail(trimmedEmail);

    if (!user || !user.reset_token || user.reset_token !== trimmedToken) {
      return res.status(400).json({ message: 'Invalid or expired password reset code' });
    }

    // Check expiration
    if (user.reset_token_expires) {
      const expires = new Date(user.reset_token_expires).getTime();
      if (Date.now() > expires) {
        return res.status(400).json({ message: 'Password reset code has expired. Please request a new code.' });
      }
    }

    // Hash new password
    const salt = bcryptjs.genSaltSync(10);
    const newPasswordHash = bcryptjs.hashSync(newPassword, salt);

    // Update password in DB
    db.resetUserPassword(user.id, newPasswordHash);

    // Log activity
    db.createActivityLog({
      request_id: 'SYSTEM',
      action: 'Password Reset Completed',
      performed_by: user.name,
      role: user.role,
      description: `Successfully reset password for email: ${user.email}`
    });

    // Send confirmation email
    sendPasswordResetSuccessEmail(user).catch(err => {
      console.error('Failed to send password reset confirmation email:', err);
    });

    return res.status(200).json({
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Internal server error during password reset' });
  }
}
