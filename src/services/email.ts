import nodemailer from 'nodemailer';
import { config } from '../config/config';
import { Request as RequestType, User } from '../types';
import { db } from '../db/db';

let transporter: any = null;

export function resetTransporter() {
  transporter = null;
}

const cleanVal = (val: string | undefined): string => {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

function getTransporter() {
  if (transporter) return transporter;

  const host = cleanVal(process.env.SMTP_HOST) || cleanVal(config.smtp.host) || 'sandbox.smtp.mailtrap.io';
  const portStr = cleanVal(process.env.SMTP_PORT) || String(config.smtp.port || 2525);
  const port = parseInt(portStr, 10) || 2525;
  const user = cleanVal(process.env.SMTP_USER) || cleanVal(config.smtp.user);
  const pass = cleanVal(process.env.SMTP_PASS) || cleanVal(config.smtp.pass);

  // If no credentials or placeholders, fallback to Virtual Mailbox mode
  if (
    !host || 
    !user || 
    !pass || 
    host.includes('example.com') || 
    user.includes('your-') || 
    pass.includes('your-')
  ) {
    return null;
  }

  try {
    console.log(`✉️ Initializing SMTP Transporter for Mailtrap: ${host}:${port}`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: {
        user,
        pass,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    return transporter;
  } catch (error) {
    console.error('⚠️ Failed to initialize Mailtrap SMTP transporter:', error);
    transporter = null;
    return null;
  }
}

export async function verifySmtp(): Promise<{ ok: boolean; configured: boolean; error?: string }> {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    return { ok: false, configured: false, error: 'SMTP credentials not configured (running in Virtual Mailbox mode).' };
  }
  try {
    await mailTransporter.verify();
    return { ok: true, configured: true };
  } catch (error: any) {
    return { ok: false, configured: true, error: error?.message || String(error) };
  }
}

// Queue item definition
interface EmailTask {
  to: string;
  subject: string;
  html: string;
  text: string;
  request_id?: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

const emailQueue: EmailTask[] = [];
let isProcessingQueue = false;
const MIN_DELAY_BETWEEN_EMAILS_MS = 1000; // Respect 1 req/sec rate limit

async function processEmailQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (emailQueue.length > 0) {
    const task = emailQueue.shift();
    if (!task) break;

    const fromAddress = `"Service Request Management System" <no-reply@requestsystem.com>`;
    let success = false;
    let attempts = 0;
    const maxAttempts = 2;
    let lastError: any = null;

    while (!success && attempts < maxAttempts) {
      attempts++;
      const mailTransporter = getTransporter();

      if (!mailTransporter) {
        // Log to Mailtrap Virtual Inbox in DB
        const mockLog = db.createEmailLog({
          to: task.to,
          from: fromAddress,
          subject: task.subject,
          text: task.text,
          html: task.html,
          request_id: task.request_id,
          status: 'Simulated (Mailtrap Virtual Inbox)',
          messageId: 'simulated-' + Math.random().toString(36).substring(2, 10)
        });

        console.log(`\n==================================================`);
        console.log(`📨 [MAILTRAP VIRTUAL OUTBOX LOGGED] TO: ${task.to}`);
        console.log(`📧 SUBJECT: ${task.subject}`);
        console.log(`==================================================\n`);

        task.resolve({ messageId: mockLog.messageId, mock: true, logId: mockLog.id });
        success = true;
        break;
      }

      try {
        const info = await mailTransporter.sendMail({
          from: fromAddress,
          to: task.to,
          subject: task.subject,
          text: task.text,
          html: task.html,
        });

        const realLog = db.createEmailLog({
          to: task.to,
          from: fromAddress,
          subject: task.subject,
          text: task.text,
          html: task.html,
          request_id: task.request_id,
          status: 'Delivered (Mailtrap SMTP)',
          messageId: info.messageId || ('smtp-' + Date.now())
        });

        console.log(`✉️ Mailtrap Email Delivered to ${task.to} [ID: ${info.messageId}]`);
        task.resolve({ ...info, logId: realLog.id });
        success = true;
      } catch (error: any) {
        lastError = error;
        const errMsg = error?.message || String(error);
        console.error(`⚠️ Mailtrap SMTP Transfer Attempt ${attempts}/${maxAttempts} Failed for ${task.to}: ${errMsg}`);

        if (attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    }

    if (!success) {
      console.error(`❌ Mailtrap SMTP Transfer Failed for ${task.to}. Falling back to Mailtrap Virtual Outbox Store.`);
      const fallbackLog = db.createEmailLog({
        to: task.to,
        from: fromAddress,
        subject: task.subject,
        text: task.text,
        html: task.html,
        request_id: task.request_id,
        status: 'Simulated (Mailtrap Virtual Inbox)',
        messageId: 'fallback-' + Math.random().toString(36).substring(2, 10),
        error: lastError?.message || 'SMTP transfer failed'
      });

      task.resolve({ messageId: fallbackLog.messageId, mock: true, logId: fallbackLog.id, error: lastError?.message });
    }

    if (emailQueue.length > 0) {
      await new Promise((res) => setTimeout(res, MIN_DELAY_BETWEEN_EMAILS_MS));
    }
  }

  isProcessingQueue = false;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  request_id
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  request_id?: string;
}): Promise<any> {
  return new Promise((resolve, reject) => {
    emailQueue.push({ to, subject, html, text, request_id, resolve, reject });
    processEmailQueue();
  });
}

/* ============================================================================
 * MODERN ENTERPRISE EMAIL UI DESIGN SYSTEM (GitHub / Stripe / Notion Style)
 * ============================================================================ */

interface BadgeConfig {
  text: string;
  bg: string;
  color: string;
  border?: string;
}

interface KeyValueItem {
  label: string;
  value: string;
  badge?: BadgeConfig;
}

interface EnterpriseEmailOptions {
  badge?: BadgeConfig;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  cta?: {
    label: string;
    url: string;
    bg?: string;
    color?: string;
  };
  footerNote?: string;
}

/**
 * Enterprise Shell Component: GitHub / Stripe clean layout wrapper
 */
function renderEnterpriseLayout(options: EnterpriseEmailOptions): string {
  const {
    badge,
    title,
    subtitle,
    bodyHtml,
    cta,
    footerNote = 'Service Request System • Enterprise Dispatch'
  } = options;

  const badgeHtml = badge
    ? `<div style="margin-bottom: 20px;">
        <span style="display: inline-block; background-color: ${badge.bg}; color: ${badge.color}; ${badge.border ? `border: 1px solid ${badge.border};` : ''} padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
          ${badge.text}
        </span>
      </div>`
    : '';

  const ctaHtml = cta
    ? `<div style="margin: 32px 0 12px 0; text-align: left;">
        <a href="${cta.url}" style="background-color: ${cta.bg || '#0f172a'}; color: ${cta.color || '#ffffff'}; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; letter-spacing: -0.1px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);">
          ${cta.label} &rarr;
        </a>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b; line-height: 1.6;">
  <div style="background-color: #f8fafc; padding: 40px 16px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width: 580px; width: 100%; margin: 0 auto;">
      <!-- Brand Header -->
      <tr>
        <td style="padding-bottom: 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="background-color: #0f172a; border-radius: 8px; width: 32px; height: 32px; text-align: center; vertical-align: middle;">
                <span style="color: #ffffff; font-weight: 800; font-size: 16px; line-height: 32px; display: block; font-family: monospace;">S</span>
              </td>
              <td style="padding-left: 12px; font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">
                Service Request Control System
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main Card Container -->
      <tr>
        <td style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px 32px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);">
          ${badgeHtml}
          <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.4px; line-height: 1.3;">
            ${title}
          </h1>
          ${subtitle ? `<p style="color: #64748b; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5; font-weight: 400;">${subtitle}</p>` : '<div style="height: 16px;"></div>'}

          <!-- Main Content Body -->
          <div style="font-size: 14px; line-height: 1.6; color: #334155;">
            ${bodyHtml}
          </div>

          ${ctaHtml}
        </td>
      </tr>

      <!-- Footer Disclaimer -->
      <tr>
        <td style="padding-top: 24px; text-align: center;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.6;">
            ${footerNote}<br>
            This is an automated system dispatch. Please do not reply directly to this email.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Reusable Key-Value Table Component (Stripe / GitHub Metadata Panel)
 */
function renderKeyValueTable(items: KeyValueItem[]): string {
  const rowsHtml = items.map((item, idx) => {
    const isEven = idx % 2 === 0;
    const bg = isEven ? '#ffffff' : '#f8fafc';
    
    let valHtml = item.value;
    if (item.badge) {
      valHtml = `<span style="background-color: ${item.badge.bg}; color: ${item.badge.color}; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px;">${item.badge.text}</span>`;
    }

    return `
      <tr style="background-color: ${bg};">
        <td style="padding: 11px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b; width: 35%; vertical-align: top;">
          ${item.label}
        </td>
        <td style="padding: 11px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #0f172a; vertical-align: top;">
          ${valHtml}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 20px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; border-collapse: collapse;">
        ${rowsHtml}
      </table>
    </div>
  `;
}

/**
 * Reusable Callout Box Component (Notion-style Quote / Alert Block)
 */
function renderCalloutBox(title: string, text: string, type: 'info' | 'warning' | 'success' | 'alert' = 'info'): string {
  let borderLeftColor = '#2563eb';
  let bgColor = '#f0f9ff';
  let titleColor = '#1e40af';
  let textColor = '#1e3a8a';

  if (type === 'warning') {
    borderLeftColor = '#d97706';
    bgColor = '#fffbeb';
    titleColor = '#92400e';
    textColor = '#78350f';
  } else if (type === 'success') {
    borderLeftColor = '#10b981';
    bgColor = '#ecfdf5';
    titleColor = '#065f46';
    textColor = '#047857';
  } else if (type === 'alert') {
    borderLeftColor = '#ef4444';
    bgColor = '#fef2f2';
    titleColor = '#9f1239';
    textColor = '#881337';
  }

  return `
    <div style="background-color: ${bgColor}; border-left: 4px solid ${borderLeftColor}; border-radius: 0 8px 8px 0; padding: 14px 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; font-weight: 700; color: ${titleColor}; uppercase; letter-spacing: 0.3px;">
        ${title}
      </p>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: ${textColor}; line-height: 1.5;">
        ${text}
      </p>
    </div>
  `;
}

/**
 * Reusable Code Block Component (GitHub-style Monospace Security Box)
 */
function renderCodeBlock(code: string, note?: string): string {
  return `
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <div style="font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #0f172a; margin-left: 10px;">
        ${code}
      </div>
      ${note ? `<p style="font-size: 12px; color: #64748b; margin: 10px 0 0 0; font-weight: 500;">${note}</p>` : ''}
    </div>
  `;
}


/* ============================================================================
 * EMAIL TEMPLATES & DISPATCHERS
 * ============================================================================ */

export async function sendTestEmail(to: string) {
  const html = renderEnterpriseLayout({
    badge: { text: 'SMTP DIAGNOSTICS • SUCCESS', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    title: 'Mailtrap Connection Active',
    subtitle: 'Nodemailer SMTP integration verified for Service Request System',
    bodyHtml: `
      <p style="margin-top: 0;">Hello System Administrator,</p>
      <p>This automated message confirms that Nodemailer and Mailtrap SMTP credentials are working correctly for outbound notifications.</p>
      ${renderCalloutBox('System Configuration Confirmed', 'Emails will be delivered via Mailtrap SMTP or stored in the Mailtrap Virtual Outbox database fallback.', 'success')}
    `,
    footerNote: 'Mailtrap System Diagnostics • Enterprise Service System'
  });

  return sendEmail({
    to,
    subject: 'Mailtrap SMTP Test Email — Request & Inventory Management System',
    text: 'This is a test email confirming that Nodemailer + Mailtrap are configured correctly.',
    html
  });
}

/**
 * Stage 1: When User creates a request -> Notify Inventory Officer & User
 */
export async function sendNewRequestNotifications(user: { name: string; email: string }, req: RequestType, officerEmails: string[]) {
  const requestLink = `${config.appUrl}/?request=${req.id}`;
  
  // Priority Badge Config
  let priorityBadge: BadgeConfig = { text: String(req.priority).toUpperCase(), bg: '#f1f5f9', color: '#475569' };
  if (req.priority === 'Urgent') {
    priorityBadge = { text: 'URGENT', bg: '#ffe4e6', color: '#9f1239' };
  } else if (req.priority === 'High') {
    priorityBadge = { text: 'HIGH', bg: '#fef3c7', color: '#92400e' };
  } else if (req.priority === 'Medium') {
    priorityBadge = { text: 'MEDIUM', bg: '#dbeafe', color: '#1e40af' };
  }

  // 1. Notify Inventory Officers
  const officerSubject = `[Action Required] New Request #${req.id} Pending Inventory Review`;
  const officerHtml = renderEnterpriseLayout({
    badge: { text: 'ACTION REQUIRED • INVENTORY REVIEW', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    title: 'New Request Submitted for Review',
    subtitle: `Submitted by ${user.name} (${req.department} Dept)`,
    bodyHtml: `
      <p style="margin-top: 0;">Hello Inventory Team,</p>
      <p>A new request has been submitted and requires inventory assessment, material allocation, and tool assignment before moving to executive review.</p>
      
      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Title', value: req.title },
        { label: 'Department', value: req.department },
        { label: 'Priority', value: req.priority, badge: priorityBadge },
        { label: 'Description', value: req.description }
      ])}
    `,
    cta: {
      label: 'Perform Inventory Review',
      url: requestLink,
      bg: '#d97706'
    }
  });

  for (const officerEmail of officerEmails) {
    sendEmail({
      to: officerEmail,
      subject: officerSubject,
      text: `New request #${req.id} submitted by ${user.name} requires inventory review.`,
      html: officerHtml,
      request_id: req.id
    }).catch(e => console.error(`Error sending email to officer ${officerEmail}:`, e));
  }

  // 2. Receipt to User
  const userSubject = `Request #${req.id} Received - Pending Inventory Review`;
  const userHtml = renderEnterpriseLayout({
    badge: { text: 'REQUEST LOGGED • PENDING REVIEW', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    title: 'Request Received Successfully',
    subtitle: `Reference ID: #${req.id}`,
    bodyHtml: `
      <p style="margin-top: 0;">Dear ${user.name},</p>
      <p>Your request <strong>"${req.title}"</strong> has been logged in our system and is currently under review by our Inventory Team.</p>
      
      ${renderCalloutBox('Next Steps', 'The Inventory Officer will evaluate material and tool requirements before forwarding your request to the Management Board for final approval.', 'info')}
      
      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Title', value: req.title },
        { label: 'Department', value: req.department },
        { label: 'Current Status', value: 'Pending Inventory Review' }
      ])}
    `,
    cta: {
      label: 'Track Request Status',
      url: requestLink,
      bg: '#2563eb'
    }
  });

  sendEmail({
    to: user.email,
    subject: userSubject,
    text: `Dear ${user.name}, your request #${req.id} has been received and sent to the Inventory Officer for review.`,
    html: userHtml,
    request_id: req.id
  }).catch(e => console.error(`Error sending email to user ${user.email}:`, e));
}

/**
 * Stage 2: Inventory Officer completes assignment -> Notify Admin & User
 */
export async function sendInventoryReviewedNotifications(
  officerName: string, 
  req: RequestType, 
  adminEmails: string[], 
  user: { name: string; email: string },
  materialsCount: number,
  toolsCount: number
) {
  const requestLink = `${config.appUrl}/?request=${req.id}`;

  // 1. Notify Admin
  const adminSubject = `[Action Required] Request #${req.id} Pending Admin Approval`;
  const adminHtml = renderEnterpriseLayout({
    badge: { text: 'ACTION REQUIRED • ADMIN APPROVAL', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },
    title: 'Inventory Review Completed',
    subtitle: `Request #${req.id} is ready for executive decision`,
    bodyHtml: `
      <p style="margin-top: 0;">Hello Admin,</p>
      <p>Inventory Officer <strong>${officerName}</strong> has completed resource assessment for Request <strong>#${req.id}</strong> ("${req.title}").</p>
      
      ${renderCalloutBox('Resource Allocation Summary', `• Assigned Materials: <strong>${materialsCount} item(s)</strong><br/>• Assigned Tools: <strong>${toolsCount} item(s)</strong>`, 'info')}

      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Title', value: req.title },
        { label: 'Department', value: req.department },
        { label: 'Reviewed By', value: officerName }
      ])}
    `,
    cta: {
      label: 'Review & Authorize Request',
      url: requestLink,
      bg: '#7c3aed'
    }
  });

  for (const adminEmail of adminEmails) {
    sendEmail({
      to: adminEmail,
      subject: adminSubject,
      text: `Inventory review completed for request #${req.id} by ${officerName}. Pending Admin Approval.`,
      html: adminHtml
    }).catch(e => console.error(`Error sending email to admin ${adminEmail}:`, e));
  }

  // 2. Update User
  const userSubject = `Update on Request #${req.id}: Inventory Reviewed & Forwarded to Admin`;
  const userHtml = renderEnterpriseLayout({
    badge: { text: 'PROGRESS UPDATE • INVENTORY CLEARED', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },
    title: 'Inventory Assessment Cleared',
    subtitle: `Your request has progressed to executive review`,
    bodyHtml: `
      <p style="margin-top: 0;">Dear ${user.name},</p>
      <p>Our Inventory Officer has reviewed your request <strong>"${req.title}"</strong> and allocated the required materials and tools.</p>
      <p>Your request has now been forwarded to the Management Board for final authorization.</p>

      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Title', value: req.title },
        { label: 'Allocated Items', value: `${materialsCount} material(s), ${toolsCount} tool(s)` },
        { label: 'New Status', value: 'Pending Admin Approval' }
      ])}
    `,
    cta: {
      label: 'View Request Progress',
      url: requestLink,
      bg: '#7c3aed'
    }
  });

  sendEmail({
    to: user.email,
    subject: userSubject,
    text: `Dear ${user.name}, your request #${req.id} passed inventory review and is now pending Admin approval.`,
    html: userHtml,
    request_id: req.id
  }).catch(e => console.error(`Error sending email to user ${user.email}:`, e));
}

/**
 * Stage 3: Admin decisions (Approved / Rejected / Need More Info) -> Notify User & Inventory Officer
 */
export async function sendAdminDecisionNotifications(
  adminName: string,
  req: RequestType,
  comments: string,
  user: { name: string; email: string },
  officerEmails: string[]
) {
  const requestLink = `${config.appUrl}/?request=${req.id}`;

  let badgeConfig = { text: req.status.toUpperCase(), bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' };
  let calloutType: 'info' | 'warning' | 'success' | 'alert' = 'info';

  if (req.status === 'Approved') {
    badgeConfig = { text: 'REQUEST APPROVED', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
    calloutType = 'success';
  } else if (req.status === 'Rejected') {
    badgeConfig = { text: 'REQUEST REJECTED', bg: '#fef2f2', color: '#9f1239', border: '#fecdd3' };
    calloutType = 'alert';
  } else if (req.status === 'Need More Information') {
    badgeConfig = { text: 'ACTION REQUIRED • DETAILS NEEDED', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
    calloutType = 'warning';
  }

  // 1. Notify User
  const userSubject = `[${req.status}] Request #${req.id} - ${req.title}`;
  const userHtml = renderEnterpriseLayout({
    badge: badgeConfig,
    title: `Request Status: ${req.status}`,
    subtitle: `Decision logged by Admin ${adminName}`,
    bodyHtml: `
      <p style="margin-top: 0;">Dear ${user.name},</p>
      <p>The Management Board has reviewed your request <strong>"${req.title}"</strong> (ID: #${req.id}) and updated its status to <strong>${req.status}</strong>.</p>
      
      ${renderCalloutBox('Admin Feedback & Comments', comments || 'No additional comments provided.', calloutType)}

      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Status', value: req.status },
        { label: 'Updated By', value: adminName }
      ])}
    `,
    cta: {
      label: 'Open Request Dashboard',
      url: requestLink,
      bg: '#0f172a'
    }
  });

  sendEmail({
    to: user.email,
    subject: userSubject,
    text: `Dear ${user.name}, your request #${req.id} status was updated to ${req.status} by Admin ${adminName}.`,
    html: userHtml,
    request_id: req.id
  }).catch(e => console.error(`Error sending email to user ${user.email}:`, e));

  // 2. Notify Inventory Officers of Decision
  const officerSubject = `[Admin Decision] Request #${req.id} is now ${req.status}`;
  const officerHtml = renderEnterpriseLayout({
    badge: { text: 'ADMIN DECISION LOGGED', bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
    title: `Admin Decision: ${req.status}`,
    subtitle: `Recorded by ${adminName} for Request #${req.id}`,
    bodyHtml: `
      <p style="margin-top: 0;">Hello Inventory Team,</p>
      <p>Admin <strong>${adminName}</strong> has updated Request <strong>#${req.id}</strong> ("${req.title}") to <strong>${req.status}</strong>.</p>
      ${renderCalloutBox('Admin Comments', comments || 'None', 'info')}
    `
  });

  for (const officerEmail of officerEmails) {
    sendEmail({
      to: officerEmail,
      subject: officerSubject,
      text: `Request #${req.id} status updated to ${req.status} by Admin ${adminName}.`,
      html: officerHtml,
      request_id: req.id
    }).catch(e => console.error(`Error sending decision email to officer ${officerEmail}:`, e));
  }
}

/**
 * Stage 4: User updates info when requested -> Notify Inventory Officer
 */
export async function sendUserProvidedInfoNotification(
  user: { name: string; email: string },
  req: RequestType,
  commentText: string,
  officerEmails: string[]
) {
  const requestLink = `${config.appUrl}/?request=${req.id}`;
  const subject = `[Response Provided] Requester Updated Info on #${req.id}`;
  
  const html = renderEnterpriseLayout({
    badge: { text: 'RESPONSE RECEIVED • RE-REVIEW', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    title: 'Requester Details Provided',
    subtitle: `Request #${req.id} status reverted to Pending Inventory Review`,
    bodyHtml: `
      <p style="margin-top: 0;">Hello Inventory Team,</p>
      <p>Requester <strong>${user.name}</strong> has submitted response details for Request <strong>#${req.id}</strong> ("${req.title}").</p>
      
      ${renderCalloutBox('Requester Comment', commentText, 'info')}

      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Title', value: req.title },
        { label: 'Submitted By', value: user.name }
      ])}
    `,
    cta: {
      label: 'Re-Review Request',
      url: requestLink,
      bg: '#2563eb'
    }
  });

  for (const officerEmail of officerEmails) {
    sendEmail({
      to: officerEmail,
      subject,
      text: `Requester ${user.name} provided info on #${req.id}: "${commentText}". Reverted to Pending Inventory Review.`,
      html,
      request_id: req.id
    }).catch(e => console.error(`Error sending email to officer ${officerEmail}:`, e));
  }
}

/**
 * Stage 5: User completes work -> Notify Admin, Inventory Officer & User
 */
export async function sendWorkCompletedNotifications(
  user: { name: string; email: string },
  req: RequestType,
  adminEmails: string[],
  officerEmails: string[]
) {
  const requestLink = `${config.appUrl}/?request=${req.id}`;

  // 1. Notify Admin
  const adminSubject = `[Work Completed] User Confirmed Completion for #${req.id}`;
  const adminHtml = renderEnterpriseLayout({
    badge: { text: 'WORK COMPLETED • CONFIRMED', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    title: 'Work Completion Confirmed',
    subtitle: `Requester confirmed resolution of "${req.title}"`,
    bodyHtml: `
      <p style="margin-top: 0;">Hello Admin,</p>
      <p>User <strong>${user.name}</strong> has confirmed that the work for Request <strong>#${req.id}</strong> ("${req.title}") is fully completed.</p>
      <p>Assigned inventory stock levels have been automatically updated in the database.</p>

      ${renderKeyValueTable([
        { label: 'Request ID', value: `#${req.id}` },
        { label: 'Title', value: req.title },
        { label: 'Completed By', value: user.name },
        { label: 'Final Status', value: 'Completed' }
      ])}
    `,
    cta: {
      label: 'View Completed Record',
      url: requestLink,
      bg: '#059669'
    }
  });

  for (const adminEmail of adminEmails) {
    sendEmail({
      to: adminEmail,
      subject: adminSubject,
      text: `User ${user.name} confirmed work completion for request #${req.id}.`,
      html: adminHtml,
      request_id: req.id
    }).catch(e => console.error(`Error sending email to admin ${adminEmail}:`, e));
  }

  // 2. Notify Inventory Officers
  const officerSubject = `[Stock Deducted] Work Completed for Request #${req.id}`;
  const officerHtml = renderEnterpriseLayout({
    badge: { text: 'STOCK DEDUCTED • INVENTORY UPDATED', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    title: 'Inventory Stock Deducted',
    subtitle: `Work confirmed complete for Request #${req.id}`,
    bodyHtml: `
      <p style="margin-top: 0;">Hello Inventory Team,</p>
      <p>Work for Request <strong>#${req.id}</strong> ("${req.title}") was confirmed complete by <strong>${user.name}</strong>.</p>
      ${renderCalloutBox('System Stock Update', 'Materials and tools allocated to this request have been deducted from active inventory stock in the system database.', 'success')}
    `
  });

  for (const officerEmail of officerEmails) {
    sendEmail({
      to: officerEmail,
      subject: officerSubject,
      text: `Work for request #${req.id} completed. Allocated stock deducted.`,
      html: officerHtml,
      request_id: req.id
    }).catch(e => console.error(`Error sending email to officer ${officerEmail}:`, e));
  }

  // 3. Receipt to User
  const userSubject = `Confirmation: Request #${req.id} Marked Completed`;
  const userHtml = renderEnterpriseLayout({
    badge: { text: 'REQUEST CLOSED • RESOLVED', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    title: 'Request Marked Completed',
    subtitle: `Thank you for confirming resolution`,
    bodyHtml: `
      <p style="margin-top: 0;">Dear ${user.name},</p>
      <p>Thank you for confirming the completion of your request <strong>"${req.title}"</strong> (ID: #${req.id}).</p>
      <p>This service request is now officially closed in our records.</p>
    `
  });

  sendEmail({
    to: user.email,
    subject: userSubject,
    text: `Dear ${user.name}, thank you for confirming completion of request #${req.id}.`,
    html: userHtml,
    request_id: req.id
  }).catch(e => console.error(`Error sending completion receipt to user ${user.email}:`, e));
}

/**
 * Send Password Reset Code / Token Email
 */
export async function sendPasswordResetEmail(user: User, token: string): Promise<any> {
  const subject = `🔐 Password Reset Security Code - Service Request System`;
  const html = renderEnterpriseLayout({
    badge: { text: 'SECURITY DISPATCH • VERIFICATION CODE', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    title: 'Password Reset Request',
    subtitle: '6-digit security code for account recovery',
    bodyHtml: `
      <p style="margin-top: 0;">Hello <strong>${user.name}</strong>,</p>
      <p>We received a request to reset the password for your account (<strong>${user.email}</strong>).</p>
      <p>Please use the 6-digit security verification code below to set a new password:</p>
      
      ${renderCodeBlock(token, 'This security code is valid for 15 minutes. Do not share this code with anyone.')}

      ${renderCalloutBox('Security Notice', 'If you did not request a password reset, please ignore this email or notify your system administrator immediately.', 'warning')}
    `
  });

  return sendEmail({
    to: user.email,
    subject,
    text: `Hello ${user.name}, your password reset code is: ${token}. It is valid for 15 minutes.`,
    html
  });
}

/**
 * Send Password Reset Confirmation Email
 */
export async function sendPasswordResetSuccessEmail(user: User): Promise<any> {
  const subject = `✅ Password Reset Successful - Service Request System`;
  const html = renderEnterpriseLayout({
    badge: { text: 'SECURITY ALERT • PASSWORD UPDATED', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    title: 'Password Successfully Reset',
    subtitle: 'Your account credentials have been updated',
    bodyHtml: `
      <p style="margin-top: 0;">Hello <strong>${user.name}</strong>,</p>
      <p>This email confirms that the password for your account (<strong>${user.email}</strong>) was successfully changed.</p>
      <p>You can now log in to the Service Request Management System using your new password.</p>
      
      ${renderCalloutBox('Security Alert', 'If you did not perform this password update, please contact your administrator immediately to safeguard your account.', 'alert')}
    `
  });

  return sendEmail({
    to: user.email,
    subject,
    text: `Hello ${user.name}, your password has been reset successfully.`,
    html
  });
}

// Warm up / verify SMTP connection early on server boot
try {
  getTransporter();
} catch (e) {
  console.error('⚠️ Pre-warm SMTP connection failed:', e);
}
