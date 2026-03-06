# Contract Event Indexer

## Overview

The Contract Event Indexer is a background service that streams Soroban contract events from the Stellar RPC and persists them to PostgreSQL. It provides a reliable, queryable audit trail for contract events without requiring the frontend to hit the RPC on every page load.

## Features

- **Background Worker**: Polls Soroban RPC every 10 seconds for new contract events
- **Multi-Contract Support**: Indexes events from multiple contracts (bulk_payment, vesting_escrow, revenue_split)
- **Idempotent Processing**: Automatically skips duplicate events on re-indexing
- **Graceful Recovery**: Restarts from the last indexed ledger sequence on crash
- **REST API**: Provides paginated access to indexed events
- **Organization Isolation**: Events are scoped to organizations for multi-tenancy

## Architecture

### Components

1. **ContractEventIndexer Service** (`src/services/contractEventIndexer.ts`)
   - Background polling service
   - Fetches events from Soroban RPC
   - Persists events to PostgreSQL
   - Tracks indexer state

2. **ContractEventController** (`src/controllers/contractEventController.ts`)
   - Handles HTTP requests for event queries
   - Provides pagination and filtering

3. **Database Tables**
   - `contract_events`: Stores indexed events
   - `indexer_state`: Tracks last indexed ledger and indexer status

4. **REST API Routes** (`src/routes/contractEventRoutes.ts`)
   - `GET /api/events/:contractId` - Get events for a specific contract
   - `GET /api/events` - Get all events for the organization
   - `GET /api/events/indexer/status` - Get indexer status

## Database Schema

### contract_events Table

```sql
CREATE TABLE contract_events (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL,
  contract_id VARCHAR(56) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  transaction_hash VARCHAR(64) NOT NULL,
  event_index INTEGER NOT NULL,
  ledger_closed_at TIMESTAMP NOT NULL,
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_event UNIQUE (contract_id, transaction_hash, event_index)
);
```

### indexer_state Table

```sql
CREATE TABLE indexer_state (
  id SERIAL PRIMARY KEY,
  indexer_name VARCHAR(100) UNIQUE NOT NULL,
  last_indexed_ledger BIGINT NOT NULL,
  last_indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  error_message TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

Add the following environment variables to your `.env` file:

```bash
# Soroban RPC URL (testnet or mainnet)
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Contract IDs to index (Stellar addresses)
BULK_PAYMENT_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VESTING_ESCROW_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
REVENUE_SPLIT_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Usage

### Starting the Indexer

The indexer starts automatically when the Express server starts:

```typescript
import { contractEventIndexer } from './services/contractEventIndexer';

// In index.ts
contractEventIndexer.initialize();
```

### Stopping the Indexer

The indexer stops gracefully on server shutdown:

```typescript
// Handles SIGTERM and SIGINT
contractEventIndexer.stop();
```

### API Endpoints

#### Get Events by Contract

```bash
GET /api/events/:contractId?page=1&limit=20&eventType=payment&fromLedger=100&toLedger=200
```

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `eventType` (optional): Filter by event type
- `fromLedger` (optional): Filter from ledger sequence
- `toLedger` (optional): Filter to ledger sequence

**Response:**

```json
{
  "events": [
    {
      "id": 1,
      "organizationId": 1,
      "contractId": "CTEST123...",
      "eventType": "payment",
      "payload": {
        "type": "contract",
        "topics": ["payment"],
        "value": { "xdr": "..." }
      },
      "ledgerSequence": 12345,
      "transactionHash": "abc123...",
      "eventIndex": 0,
      "ledgerClosedAt": "2024-01-01T00:00:00Z",
      "indexedAt": "2024-01-01T00:01:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Get All Events

```bash
GET /api/events?page=1&limit=20
```

Returns events from all indexed contracts for the authenticated user's organization.

#### Get Indexer Status

```bash
GET /api/events/indexer/status
```

**Response:**

```json
{
  "indexerName": "contract_event_indexer",
  "lastIndexedLedger": 12345,
  "lastIndexedAt": "2024-01-01T00:00:00Z",
  "status": "active",
  "errorMessage": null,
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## How It Works

### Polling Loop

1. Every 10 seconds, the indexer queries the `indexer_state` table for the last indexed ledger
2. For each configured contract, it calls the Soroban RPC `getEvents` method
3. Events are fetched starting from `lastIndexedLedger + 1`
4. New events are inserted into the `contract_events` table
5. The `indexer_state` is updated with the highest ledger processed

### Idempotent Processing

The `contract_events` table has a unique constraint on `(contract_id, transaction_hash, event_index)`. This ensures that:

- Duplicate events are automatically skipped via `ON CONFLICT DO NOTHING`
- Re-indexing is safe and won't create duplicate records
- The indexer can be restarted at any time without data corruption

### Graceful Recovery

On startup or crash recovery:

1. The indexer reads the `last_indexed_ledger` from the database
2. It resumes indexing from that ledger + 1
3. No events are missed or duplicated

### Error Handling

- Individual contract indexing errors are logged but don't stop other contracts
- RPC errors are caught and logged with the indexer state set to 'error'
- The indexer continues running even after errors
- Failed batches can be re-processed by manually resetting the `last_indexed_ledger`

## Testing

Run the test suite:

```bash
npm test -- contractEventIndexer
npm test -- contractEventController
```

## Monitoring

Monitor the indexer health by:

1. Checking the indexer status endpoint: `GET /api/events/indexer/status`
2. Monitoring server logs for `[ContractEventIndexer]` messages
3. Querying the `indexer_state` table directly:

```sql
SELECT * FROM indexer_state WHERE indexer_name = 'contract_event_indexer';
```

## Performance Considerations

- **Batch Size**: Currently set to 100 events per RPC call (configurable via `BATCH_SIZE`)
- **Poll Interval**: 10 seconds (configurable via `POLL_INTERVAL_MS`)
- **Indexes**: Multiple indexes on `contract_events` for efficient querying
- **JSONB**: Event payload stored as JSONB with GIN index for flexible queries

## Future Enhancements

- [ ] WebSocket streaming instead of polling
- [ ] Event filtering by topic patterns
- [ ] Event decoding and parsing (XDR to JSON)
- [ ] Webhook notifications for new events
- [ ] Multi-organization contract mapping
- [ ] Backfill historical events
- [ ] Event retention policies
- [ ] Metrics and monitoring dashboard

## Troubleshooting

### Indexer Not Starting

Check that:

- At least one contract ID is configured in environment variables
- Database migrations have been run
- Soroban RPC URL is accessible

### Events Not Appearing

Check:

- Indexer status: `GET /api/events/indexer/status`
- Server logs for errors
- Contract IDs are correct
- Events exist on the blockchain for those contracts

### Duplicate Events

This should not happen due to the unique constraint. If it does:

- Check database constraints are in place
- Verify migration 016 was applied correctly

### Performance Issues

If indexing is slow:

- Increase `BATCH_SIZE` for more events per RPC call
- Decrease `POLL_INTERVAL_MS` for more frequent polling
- Add more database indexes if needed
- Consider using Soroban RPC streaming (future enhancement)
