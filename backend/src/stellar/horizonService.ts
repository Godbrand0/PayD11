import { Horizon } from "@stellar/stellar-sdk";
import { getNetworkConfig, NetworkConfig, StellarNetwork } from "./network";

export interface HealthCheckResult {
    healthy: boolean;
    network: StellarNetwork;
    horizonUrl: string;
    latencyMs: number;
    ledgerSequence?: number;
    error?: string;
}

interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
};

/**
 * HorizonService abstracts the Stellar Horizon client into a reusable service
 * module. It handles:
 *  - Configuration switching between Testnet and Mainnet via env vars
 *  - Lazy-initialised cached Horizon.Server instance
 *  - Exponential-backoff retry logic for transient network errors
 *  - Connection health checks that can be run on service startup
 */
export class HorizonService {
    private server: Horizon.Server | null = null;
    private config: NetworkConfig | null = null;
    private retryOptions: Required<RetryOptions>;

    constructor(retryOptions: RetryOptions = {}) {
        this.retryOptions = { ...DEFAULT_RETRY, ...retryOptions };
    }

    // ─── Config & Server ────────────────────────────────────────────────────────

    /**
     * Returns the resolved network configuration, reading from env vars.
     * Result is cached after the first call.
     */
    getConfig(): NetworkConfig {
        if (!this.config) {
            this.config = getNetworkConfig();
        }
        return this.config;
    }

    /**
     * Returns the cached Horizon.Server instance, creating it on first access.
     */
    getServer(): Horizon.Server {
        if (!this.server) {
            const { horizonUrl } = this.getConfig();
            this.server = new Horizon.Server(horizonUrl);
        }
        return this.server;
    }

    /**
     * Clears the cached server and config so the next call re-reads the
     * environment. Useful for tests or runtime environment switching.
     */
    reset(): void {
        this.server = null;
        this.config = null;
    }

    // ─── Retry Logic ────────────────────────────────────────────────────────────

    /**
     * Executes an async operation with exponential-backoff retry logic for
     * transient network errors. Permanent errors (4xx) are NOT retried.
     */
    async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        const { maxAttempts, baseDelayMs, maxDelayMs } = this.retryOptions;
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (err: unknown) {
                lastError = err;

                // If it's an HTTP error we can inspect the status code
                const status = (err as { response?: { status?: number } })?.response?.status;

                // Don't retry on permanent client errors (400–499)
                if (status !== undefined && status >= 400 && status < 500) {
                    throw err;
                }

                if (attempt < maxAttempts) {
                    const delay = Math.min(
                        baseDelayMs * Math.pow(2, attempt - 1),
                        maxDelayMs
                    );
                    console.warn(
                        `[HorizonService] attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms…`
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    // ─── Health Checks ───────────────────────────────────────────────────────────

    /**
     * Performs a health check against the configured Horizon server by fetching
     * fee stats. Returns latency and ledger info on success, or an error on
     * failure. Intended to be called during service startup.
     */
    async healthCheck(): Promise<HealthCheckResult> {
        const config = this.getConfig();
        const server = this.getServer();
        const start = Date.now();

        try {
            const feeStats = await server.feeStats();
            return {
                healthy: true,
                network: config.network,
                horizonUrl: config.horizonUrl,
                latencyMs: Date.now() - start,
                ledgerSequence: Number(feeStats.last_ledger),
            };
        } catch (err) {
            return {
                healthy: false,
                network: config.network,
                horizonUrl: config.horizonUrl,
                latencyMs: Date.now() - start,
                error: err instanceof Error ? err.message : "Unknown connection error",
            };
        }
    }

    /**
     * Runs a health check on startup and logs the result. Throws if the server
     * is unreachable, so the application can exit cleanly instead of silently
     * operating in a degraded state.
     *
     * @param throwOnFailure  Set to false to warn but allow the app to continue.
     */
    async checkOnStartup(throwOnFailure = true): Promise<HealthCheckResult> {
        console.log("[HorizonService] Running startup health check…");
        const result = await this.healthCheck();

        if (result.healthy) {
            console.log(
                `[HorizonService] Connected to Stellar ${result.network} ` +
                `(ledger ${result.ledgerSequence ?? "n/a"}, latency ${result.latencyMs}ms)`
            );
        } else {
            const msg =
                `[HorizonService] Horizon health check failed: ${result.error}` +
                ` (url: ${result.horizonUrl}, network: ${result.network})`;

            if (throwOnFailure) {
                throw new Error(msg);
            }
            console.warn(msg);
        }

        return result;
    }
}

// ─── Singleton Export ────────────────────────────────────────────────────────
// A default shared instance for convenience. Services that need custom retry
// behaviour can instantiate HorizonService directly.
export const horizonService = new HorizonService();
