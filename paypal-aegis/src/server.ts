import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import logger from './lib/logger';
import { store } from './lib/store';
import { safeGate } from './engines/safegate';
import { holdManager } from './engines/hold-manager';

// Import Routes
import safegateRoutes from './routes/safegate.routes';
import escrowRoutes from './routes/escrow.routes';
import disputesRoutes from './routes/disputes.routes';
import hitlRoutes from './routes/hitl.routes';
import webhooksRoutes from './routes/webhooks.routes';
import demoRoutes from './routes/demo.routes';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time AG Studio 3 & Bryntum Gantt updates
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Register Socket.IO emitter with SafeGate HITL
safeGate.registerSocketEmitter((event: string, data: unknown) => {
  io.emit(event, data);
});

// Broadcast schedule sync events to Bryntum Gantt frontend
holdManager.onScheduleSync((event) => {
  io.emit('schedule:sync', event);
});

io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });
  socket.emit('connected', {
    message: 'Connected to PayPal Aegis real-time command stream',
    mode: config.paypal.isConfigured ? 'LIVE_SANDBOX' : 'DETERMINISTIC_SIMULATION',
    timestamp: new Date().toISOString(),
  });

  socket.on('disconnect', () => {
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });
});

// Enable CORS
app.use(cors());

// Webhook route handler with raw body parser for CRC32 signature verification
// MUST be mounted before express.json() for /api/webhooks/paypal
app.use(
  '/api/webhooks/paypal',
  express.raw({ type: '*/*', limit: '10mb' })
);

// Standard JSON body parser for all other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/health')) {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      ip: req.ip,
    });
  }
  next();
});

// Mount API Routes
app.use('/api/safegate', safegateRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/disputes', disputesRoutes);
app.use('/api/hitl', hitlRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/demo', demoRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'paypal-aegis',
    environment: config.nodeEnv,
    paypalMode: config.paypal.isConfigured ? 'SANDBOX' : 'SIMULATION',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled server error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});

// Initialize demo fixtures on startup so data is immediately visible
async function initializeDemoState() {
  logger.info('Populating initial PayPal Aegis command center state...');
  try {
    // Seed sample project and milestones
    const projectId = 'proj-aegis-demo';
    const now = new Date();

    const sampleProject = {
      id: projectId,
      name: 'Acme Global — Enterprise Cloud & ERP Migration',
      clientName: 'Acme Global Ventures LLC',
      clientEmail: 'procurement@acmeglobal.sandbox.com',
      description:
        'Full-lifecycle milestone delivery: Cloud Infrastructure Architecture, Custom ERP Reconciliation Module, and Production SOC2 Audit.',
      totalAmount: { currency_code: 'USD', value: '4500.00' },
      status: 'ACTIVE' as const,
      createdAt: now,
      updatedAt: now,
      milestones: [],
    };
    store.setProject(sampleProject);

    const m1 = {
      id: 'm1-cloud-arch',
      projectId,
      name: 'Milestone 1: Cloud Infrastructure & High-Availability Plan',
      description: 'Design and deploy multi-region VPCs, Terraform modules, and CI/CD pipelines.',
      amount: { currency_code: 'USD', value: '1250.00' },
      status: 'DRAFT' as const,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      dependencies: [],
      deliverables: [],
      evidenceDocuments: [],
      authorizationHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    const m2 = {
      id: 'm2-erp-sync',
      projectId,
      name: 'Milestone 2: Custom PayPal ERP Reconciliation Module',
      description: 'Develop bidirectional ledger synchronization with Orders v2 and dispute webhooks.',
      amount: { currency_code: 'USD', value: '1750.00' },
      status: 'DRAFT' as const,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      dependencies: ['m1-cloud-arch'],
      deliverables: [],
      evidenceDocuments: [],
      authorizationHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    const m3 = {
      id: 'm3-soc2-audit',
      projectId,
      name: 'Milestone 3: Production SOC2 Audit & Final Sign-Off',
      description: 'Third-party penetration testing, audit trail indexing, and final sign-off.',
      amount: { currency_code: 'USD', value: '1500.00' },
      status: 'DRAFT' as const,
      dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      dependencies: ['m2-erp-sync'],
      deliverables: [],
      evidenceDocuments: [],
      authorizationHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    store.setMilestone(m1);
    store.setMilestone(m2);
    store.setMilestone(m3);

    // Lock hold on Milestone 1 automatically
    await holdManager.createMilestoneHold('m1-cloud-arch');

    logger.info('Initial PayPal Aegis demo state initialized successfully.');
  } catch (err: any) {
    logger.warn('Failed to initialize demo state on startup', { error: err.message });
  }
}

// Start Server
const PORT = config.port || 3001;

server.listen(PORT, async () => {
  logger.info(`====================================================`);
  logger.info(`🛡️  PayPal Aegis Operating System Started`);
  logger.info(`📡 Port: ${PORT}`);
  logger.info(`🔗 Base URL: http://localhost:${PORT}`);
  logger.info(`🔒 Mode: ${config.paypal.isConfigured ? 'LIVE SANDBOX' : 'DETERMINISTIC SIMULATION'}`);
  logger.info(`🌐 Webhook URL: http://localhost:${PORT}/api/webhooks/paypal`);
  logger.info(`====================================================`);

  await initializeDemoState();
});

export { app, server, io };

