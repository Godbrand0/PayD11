# Contract Event Indexer - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Express Backend                              │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    ContractEventIndexer                         │ │
│  │                   (Background Service)                          │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Polling Loop (every 10 seconds)                         │  │ │
│  │  │                                                           │  │ │
│  │  │  1. Read last_indexed_ledger from DB                     │  │ │
│  │  │  2. For each contract:                                   │  │ │
│  │  │     - Fetch events from Soroban RPC                      │  │ │
│  │  │     - Parse and validate events                          │  │ │
│  │  │     - Insert into contract_events (skip duplicates)      │  │ │
│  │  │  3. Update indexer_state with new ledger                 │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  ContractEventController                        │ │
│  │                      (REST API)                                 │ │
│  │                                                                  │ │
│  │  GET /api/events/:contractId  → Query events by contract       │ │
│  │  GET /api/events              → Query all events               │ │
│  │  GET /api/events/indexer/status → Get indexer health           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                │ HTTP/JSON-RPC
                                ▼
                    ┌───────────────────────┐
                    │   Soroban RPC Server  │
                    │  (Stellar Network)    │
                    │                       │
                    │  - getEvents()        │
                    │  - Contract events    │
                    │  - Ledger data        │
                    └───────────────────────┘
                                │
                                │ Blockchain Events
                                ▼
                    ┌───────────────────────┐
                    │  Smart Contracts      │
                    │                       │
                    │  - bulk_payment       │
                    │  - vesting_escrow     │
                    │  - revenue_split      │
                    └───────────────────────┘
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────┐
│                     contract_events                          │
├─────────────────────────────────────────────────────────────┤
│ id                  SERIAL PRIMARY KEY                       │
│ organization_id     INTEGER (FK → organizations)             │
│ contract_id         VARCHAR(56)                              │
│ event_type          VARCHAR(100)                             │
│ payload             JSONB                                    │
│ ledger_sequence     BIGINT                                   │
│ transaction_hash    VARCHAR(64)                              │
│ event_index         INTEGER                                  │
│ ledger_closed_at    TIMESTAMP                                │
│ indexed_at          TIMESTAMP                                │
│                                                              │
│ UNIQUE (contract_id, transaction_hash, event_index)         │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ Tracks
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      indexer_state                           │
├─────────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                     │
│ indexer_name          VARCHAR(100) UNIQUE                    │
│ last_indexed_ledger   BIGINT                                 │
│ last_indexed_at       TIMESTAMP                              │
│ status                VARCHAR(20)                            │
│ error_message         TEXT                                   │
│ updated_at            TIMESTAMP                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Indexing Flow

```
1. Timer Trigger (every 10s)
   │
   ▼
2. Get Last Indexed Ledger
   │
   ▼
3. For Each Contract:
   │
   ├─► Fetch Events from RPC
   │   (startLedger = last_indexed_ledger + 1)
   │
   ├─► Parse Event Data
   │   - Extract event_type from topics
   │   - Parse payload from XDR
   │   - Extract event_index from ID
   │
   ├─► Insert into Database
   │   - BEGIN transaction
   │   - INSERT with ON CONFLICT DO NOTHING
   │   - UPDATE indexer_state
   │   - COMMIT transaction
   │
   └─► Log Results
       (inserted count, skipped count)
```

### Query Flow

```
1. HTTP Request
   │
   ▼
2. Authentication & Authorization
   │
   ▼
3. Parse Query Parameters
   - contractId (optional)
   - eventType (optional)
   - fromLedger, toLedger (optional)
   - page, limit (pagination)
   │
   ▼
4. Build SQL Query
   - WHERE clauses for filters
   - ORDER BY ledger_sequence DESC
   - LIMIT/OFFSET for pagination
   │
   ▼
5. Execute Query
   - Count total matching events
   - Fetch paginated results
   │
   ▼
6. Format Response
   {
     events: [...],
     pagination: {
       page, limit, total, totalPages
     }
   }
```

## Component Interactions

```
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │ HTTP GET /api/events/:contractId
       │
       ▼
┌──────────────────────────────┐
│  ContractEventController     │
│  - Authenticate user          │
│  - Validate organization      │
│  - Parse filters              │
│  - Query database             │
│  - Return paginated results   │
└──────┬───────────────────────┘
       │ SQL Query
       │
       ▼
┌──────────────────────────────┐
│  PostgreSQL Database         │
│  - contract_events table     │
│  - Indexed for fast queries  │
│  - JSONB for flexible data   │
└──────▲───────────────────────┘
       │ INSERT events
       │
┌──────┴───────────────────────┐
│  ContractEventIndexer        │
│  - Poll every 10 seconds     │
│  - Fetch from Soroban RPC    │
│  - Parse and store events    │
│  - Track indexer state       │
└──────┬───────────────────────┘
       │ JSON-RPC getEvents
       │
       ▼
┌──────────────────────────────┐
│  Soroban RPC Server          │
│  - Stellar blockchain data   │
│  - Contract event stream     │
│  - Ledger information        │
└──────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Scenarios                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RPC Connection Error                                        │
│  ├─► Log error                                               │
│  ├─► Update indexer_state.status = 'error'                  │
│  ├─► Continue polling (retry on next cycle)                 │
│  └─► Don't crash the service                                │
│                                                              │
│  Database Error                                              │
│  ├─► Rollback transaction                                    │
│  ├─► Log error with details                                 │
│  ├─► Update indexer_state with error_message                │
│  └─► Continue with next contract                            │
│                                                              │
│  Duplicate Event                                             │
│  ├─► ON CONFLICT DO NOTHING (silent skip)                   │
│  ├─► Increment skipped counter                              │
│  └─► Continue processing                                    │
│                                                              │
│  Invalid Event Data                                          │
│  ├─► Log warning with event details                         │
│  ├─► Skip event                                              │
│  └─► Continue with next event                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Current Design

- **Polling Interval**: 10 seconds (configurable)
- **Batch Size**: 100 events per RPC call
- **Concurrent Contracts**: Sequential processing
- **Database**: Single connection pool

### Scaling Options

```
┌─────────────────────────────────────────────────────────────┐
│                  Horizontal Scaling                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Option 1: Multiple Indexer Instances                       │
│  ├─► Each instance handles different contracts              │
│  ├─► Use distributed locking (Redis/PostgreSQL)             │
│  └─► Coordinate via indexer_state table                     │
│                                                              │
│  Option 2: Event Streaming                                  │
│  ├─► Replace polling with WebSocket streaming               │
│  ├─► Real-time event processing                             │
│  └─► Lower latency, higher throughput                       │
│                                                              │
│  Option 3: Message Queue                                    │
│  ├─► RabbitMQ/Kafka for event buffering                     │
│  ├─► Multiple workers consume from queue                    │
│  └─► Better fault tolerance                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Security

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Authentication                                           │
│     └─► JWT token required for all API endpoints            │
│                                                              │
│  2. Authorization                                            │
│     └─► Organization isolation via user context             │
│                                                              │
│  3. Input Validation                                         │
│     └─► Query parameter sanitization                        │
│                                                              │
│  4. SQL Injection Prevention                                 │
│     └─► Parameterized queries only                          │
│                                                              │
│  5. Rate Limiting                                            │
│     └─► (Future: Add rate limiting middleware)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Points                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Metrics to Track:                                           │
│  ├─► Events indexed per minute                              │
│  ├─► Indexer lag (current ledger - last indexed)            │
│  ├─► RPC response time                                       │
│  ├─► Database query performance                             │
│  ├─► Error rate by type                                     │
│  └─► Duplicate event rate                                   │
│                                                              │
│  Health Checks:                                              │
│  ├─► GET /api/events/indexer/status                         │
│  ├─► Check indexer_state.status                             │
│  ├─► Verify last_indexed_at is recent                       │
│  └─► Monitor error_message field                            │
│                                                              │
│  Logging:                                                    │
│  ├─► [ContractEventIndexer] prefix for all logs             │
│  ├─► Structured logging with context                        │
│  ├─► Error stack traces                                     │
│  └─► Performance metrics                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Setup                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐         ┌────────────────┐             │
│  │  Load Balancer │────────▶│  Express App   │             │
│  └────────────────┘         │  + Indexer     │             │
│                              └────────┬───────┘             │
│                                       │                     │
│                                       ▼                     │
│                              ┌────────────────┐             │
│                              │  PostgreSQL    │             │
│                              │  (Primary)     │             │
│                              └────────┬───────┘             │
│                                       │                     │
│                                       │ Replication         │
│                                       ▼                     │
│                              ┌────────────────┐             │
│                              │  PostgreSQL    │             │
│                              │  (Replica)     │             │
│                              └────────────────┘             │
│                                                              │
│  External Services:                                          │
│  ├─► Soroban RPC (Stellar Network)                          │
│  ├─► Monitoring (Prometheus/Grafana)                        │
│  └─► Log Aggregation (ELK/Datadog)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```
