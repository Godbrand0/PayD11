import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import { scheduleExecutor } from './services/scheduleExecutor.js';
import { contractEventIndexer } from './services/contractEventIndexer.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

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
