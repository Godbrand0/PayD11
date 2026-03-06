import { Router } from 'express';
import { ContractEventController } from '../controllers/contractEventController.js';
import { authenticateJWT } from '../middlewares/auth.js';
import { isolateOrganization } from '../middlewares/rbac.js';

const router = Router();

// Apply authentication to all event routes
router.use(authenticateJWT);
router.use(isolateOrganization);

/**
 * @route GET /api/events/indexer/status
 * @desc Get indexer status and last indexed ledger
 * @access Private - Requires authentication
 * @returns {IndexerState} Indexer status information
 */
router.get(
  '/indexer/status',
  ContractEventController.getIndexerStatus
);

/**
 * @route GET /api/events/:contractId
 * @desc Get paginated events for a specific contract
 * @access Private - Requires authentication
 * @param {string} contractId - Contract ID (Stellar address)
 * @query {string} eventType - Optional filter by event type
 * @query {number} fromLedger - Optional filter from ledger sequence
 * @query {number} toLedger - Optional filter to ledger sequence
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @returns {PaginatedContractEvents} Paginated list of contract events
 */
router.get(
  '/:contractId',
  ContractEventController.getEventsByContract
);

/**
 * @route GET /api/events
 * @desc Get all events across all contracts for the organization
 * @access Private - Requires authentication
 * @query {string} eventType - Optional filter by event type
 * @query {number} fromLedger - Optional filter from ledger sequence
 * @query {number} toLedger - Optional filter to ledger sequence
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @returns {PaginatedContractEvents} Paginated list of contract events
 */
router.get(
  '/',
  ContractEventController.getAllEvents
);

export default router;
