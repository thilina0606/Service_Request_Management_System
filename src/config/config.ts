import dotenv from 'dotenv';
const result = dotenv.config({ override: true });

// Robust helper to strip any surrounding single or double quotes injected in .env
const cleanEnv = (val: string | undefined): string => {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
};

if (result.parsed) {
  console.log('📬 Environment variables loaded from .env');
} else {
  console.log('ℹ️ Operating with default/environment variables');
}

console.log('📧 Configured SMTP details:', {
  host: cleanEnv(process.env.SMTP_HOST),
  port: cleanEnv(process.env.SMTP_PORT),
  user: cleanEnv(process.env.SMTP_USER) ? '***' : '(not set)',
  pass: cleanEnv(process.env.SMTP_PASS) ? '***' : '(not set)'
});

export const config = {
  port: parseInt(cleanEnv(process.env.PORT) || '3000', 10),
  jwtSecret: cleanEnv(process.env.JWT_SECRET) || 'request-mgt-system-super-jwt-token-secret-fallback-2026',
  smtp: {
    host: cleanEnv(process.env.SMTP_HOST) || 'sandbox.smtp.mailtrap.io',
    port: parseInt(cleanEnv(process.env.SMTP_PORT) || '2525', 10),
    user: cleanEnv(process.env.SMTP_USER) || '449145fc38903d',
    pass: cleanEnv(process.env.SMTP_PASS) || '3757bb1b74e11c',
  },
  appUrl: cleanEnv(process.env.APP_URL) || 'http://localhost:3000'
};
