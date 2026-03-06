import { Request, Response } from 'express';
import { default as pool } from '../config/database.js';
import type { ContractEventFilters, PaginatedContractEvents } from '../types/contractEvent.js';

export class ContractEventController {
  /**
   * GET /api/events/:contractId
   * Get paginated events for a specific contract
   */
  static async getEventsByContract(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        res.status(403).json({ error: 'User is not associated with an organization' });
        return;
      }

      // Parse query parameters
      const filters: ContractEventFilters = {
        eventType: req.query.eventType as string | undefined,
        fromLedger: req.query.fromLedger ? parseInt(req.query.fromLedger as string, 10) : undefined,
        toLedger: req.query.toLedger ? parseInt(req.query.toLedger as string, 10) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      // Validate pagination
      if (filters.page! < 1) filters.page = 1;
      if (filters.limit! < 1 || filters.limit! > 100) filters.limit = 20;

      const result = await ContractEventController.fetchEvents(
        contractId,
        organizationId,
        filters
      );

      res.json(result);
    } catch (error) {
      console.error('[ContractEventController] Error fetching events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/events
   * Get all events across all contracts for the organization
   */
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        res.status(403).json({ error: 'User is not associated with an organization' });
        return;
      }

      // Parse query parameters
      const filters: ContractEventFilters = {
        eventType: req.query.eventType as string | undefined,
        fromLedger: req.query.fromLedger ? parseInt(req.query.fromLedger as string, 10) : undefined,
        toLedger: req.query.toLedger ? parseInt(req.query.toLedger as string, 10) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      // Validate pagination
      if (filters.page! < 1) filters.page = 1;
      if (filters.limit! < 1 || filters.limit! > 100) filters.limit = 20;

      const result = await ContractEventController.fetchEvents(
        null,
        organizationId,
        filters
      );

      res.json(result);
    } catch (error) {
      console.error('[ContractEventController] Error fetching all events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Helper method to fetch events from database
   */
  private static async fetchEvents(
    contractId: string | null,
    organizationId: number,
    filters: ContractEventFilters
  ): Promise<PaginatedContractEvents> {
    const { eventType, fromLedger, toLedger, page, limit } = filters;
    const offset = ((page || 1) - 1) * (limit || 20);

    // Build WHERE clause
    const conditions: string[] = ['organization_id = $1'];
    const values: any[] = [organizationId];
    let paramIndex = 2;

    if (contractId) {
      conditions.push(`contract_id = $${paramIndex}`);
      values.push(contractId);
      paramIndex++;
    }

    if (eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      values.push(eventType);
      paramIndex++;
    }

    if (fromLedger !== undefined) {
      conditions.push(`ledger_sequence >= $${paramIndex}`);
      values.push(fromLedger);
      paramIndex++;
    }

    if (toLedger !== undefined) {
      conditions.push(`ledger_sequence <= $${paramIndex}`);
      values.push(toLedger);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM contract_events
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated events
    const eventsQuery = `
      SELECT 
        id,
        organization_id as "organizationId",
        contract_id as "contractId",
        event_type as "eventType",
        payload,
        ledger_sequence as "ledgerSequence",
        transaction_hash as "transactionHash",
        event_index as "eventIndex",
        ledger_closed_at as "ledgerClosedAt",
        indexed_at as "indexedAt"
      FROM contract_events
      WHERE ${whereClause}
      ORDER BY ledger_sequence DESC, event_index DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(limit, offset);

    const eventsResult = await pool.query(eventsQuery, values);

    return {
      events: eventsResult.rows,
      pagination: {
        page: page || 1,
        limit: limit || 20,
        total,
        totalPages: Math.ceil(total / (limit || 20)),
      },
    };
  }

  /**
   * GET /api/events/indexer/status
   * Get indexer status
   */
  static async getIndexerStatus(req: Request, res: Response): Promise<void> {
    try {
      const query = `
        SELECT 
          indexer_name as "indexerName",
          last_indexed_ledger as "lastIndexedLedger",
          last_indexed_at as "lastIndexedAt",
          status,
          error_message as "errorMessage",
          updated_at as "updatedAt"
        FROM indexer_state
        WHERE indexer_name = 'contract_event_indexer'
      `;

      const result = await pool.query(query);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Indexer state not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('[ContractEventController] Error fetching indexer status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
