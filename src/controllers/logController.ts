import { Response } from 'express';
import { db } from '../db/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendTestEmail, verifySmtp } from '../services/email';

/**
 * GET /api/admin/logs/email
 * Retrieves all Mailtrap SMTP & Virtual Inbox email dispatch logs
 */
export async function getEmailLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const logs = db.getEmailLogs();
    // Sort newest first
    const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Check SMTP connection status
    const smtpStatus = await verifySmtp();

    return res.status(200).json({
      logs: sorted,
      smtpStatus,
      totalCount: sorted.length
    });
  } catch (error: any) {
    console.error('Error fetching email logs:', error);
    return res.status(500).json({ message: 'Internal server error fetching email logs' });
  }
}

/**
 * DELETE /api/admin/logs/email
 * Clears stored email logs
 */
export async function clearEmailLogs(req: AuthenticatedRequest, res: Response) {
  try {
    db.clearEmailLogs();
    return res.status(200).json({ message: 'Email logs cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing email logs:', error);
    return res.status(500).json({ message: 'Internal server error clearing email logs' });
  }
}

/**
 * GET /api/admin/logs/activity
 * Retrieves all system audit & activity logs
 */
export async function getActivityLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const logs = db.getActivityLogs();
    const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return res.status(200).json({
      logs: sorted,
      totalCount: sorted.length
    });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({ message: 'Internal server error fetching activity logs' });
  }
}

/**
 * DELETE /api/admin/logs/activity
 * Clears stored activity logs
 */
export async function clearActivityLogs(req: AuthenticatedRequest, res: Response) {
  try {
    db.clearActivityLogs();
    return res.status(200).json({ message: 'Activity logs cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing activity logs:', error);
    return res.status(500).json({ message: 'Internal server error clearing activity logs' });
  }
}

/**
 * POST /api/admin/logs/test-email
 * Sends a live test email to Mailtrap
 */
export async function postTestEmail(req: AuthenticatedRequest, res: Response) {
  try {
    const { to } = req.body;
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ message: 'Recipient email address "to" is required.' });
    }

    const result = await sendTestEmail(to);
    return res.status(200).json({
      message: `Test email dispatched to ${to}`,
      result
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return res.status(500).json({ message: error?.message || 'Failed to send test email' });
  }
}
