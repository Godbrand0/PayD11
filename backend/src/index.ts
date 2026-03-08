import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import { scheduleExecutor } from './services/scheduleExecutor.js';
import { contractEventIndexer } from './services/contractEventIndexer.js';
import { LedgerObserverService } from './services/ledgerObserverService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

app.get('/.well-known/stellar.toml', (req, res) => {
  const issuer = process.env.ORGUSD_ISSUER_PUBLIC;
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE;

  if (!issuer) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'ORGUSD_ISSUER_PUBLIC is not configured',
    });
    return;
  }

  const toml = [
    'VERSION="2.0.0"',
    networkPassphrase ? `NETWORK_PASSPHRASE="${networkPassphrase}"` : null,
    '',
    '[DOCUMENTATION]',
    'ORG_NAME="PayD"',
    'ORG_URL="https://github.com/pope-h/PayD"',
    'ORG_DESCRIPTION="PayD is a Stellar-based cross-border payroll platform."',
    'ORG_GITHUB="pope-h/PayD"',
    'ORG_OFFICIAL_EMAIL="support@example.com"',
    '',
    '[[CURRENCIES]]',
    'code="ORGUSD"',
    `issuer="${issuer}"`,
    'display_decimals=2',
    'name="ORGUSD"',
    'desc="Organization-specific stablecoin used for payroll disbursements on Stellar."',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(toml);
});

// Routes
app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize ScheduleExecutor after server starts
  scheduleExecutor.initialize();
  console.log('ScheduleExecutor initialized');

  // Initialize ContractEventIndexer
  contractEventIndexer.initialize();
  console.log('ContractEventIndexer initialized');

  // Start the Ledger Observer Service to listen for Stellar events
  LedgerObserverService.start().catch((err: any) => {
    console.error('Failed to start LedgerObserverService:', err);
  });
});

// Graceful shutdown handling
const shutdown = () => {
  console.log('Shutting down gracefully...');

  // Stop the schedule executor
  scheduleExecutor.stop();

  // Stop the contract event indexer
  contractEventIndexer.stop();

  // Close the server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
