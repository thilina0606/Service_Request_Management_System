import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './src/config/config';
import authRouter from './src/routes/auth';
import requestsRouter from './src/routes/requests';
import reportsRouter from './src/routes/reports';
import inventoryRouter from './src/routes/inventory';
import logsRouter from './src/routes/logs';
import { verifySmtp, sendTestEmail } from './src/services/email';

async function startServer() {
  const app = express();
  const PORT = config.port;

  // Parse JSON bodies
  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // SMTP diagnostics: shows config + verifies the connection, surfacing the real error.
  // Visit: /api/health/email        -> checks config & verifies SMTP connection
  //        /api/health/email?to=you@example.com -> also sends a real test email to Mailtrap
  app.get('/api/health/email', async (req, res) => {
    try {
      const smtpConfig = {
        host: config.smtp.host || '(not set)',
        port: config.smtp.port,
        user: config.smtp.user ? '***set***' : '(not set)',
        pass: config.smtp.pass ? '***set***' : '(not set)',
      };

      const verification = await verifySmtp();

      let testSend: any = null;
      const to = typeof req.query.to === 'string' ? req.query.to : null;
      if (to && verification.ok) {
        try {
          const info = await sendTestEmail(to);
          testSend = { sent: true, messageId: (info as any)?.messageId, accepted: (info as any)?.accepted };
        } catch (err: any) {
          testSend = { sent: false, error: err?.message || String(err), code: err?.code, response: err?.response };
        }
      }

      res.status(verification.ok ? 200 : 500).json({
        smtpConfig,
        verification,
        testSend,
        hint: verification.ok
          ? 'SMTP connection OK. Add ?to=your@email.com to send a real test email to Mailtrap.'
          : 'SMTP verification failed. Check the "verification.error" field and confirm your Mailtrap credentials and that .env is loaded in this environment.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/admin/reports', reportsRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/admin/logs', logsRouter);

  // Vite Integration for Assets/Frontend Routing
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev server integrated as Express middleware.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('📦 Serving compiled production static assets from /dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Request Management System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('💥 Critical failure starting server:', err);
  process.exit(1);
});
