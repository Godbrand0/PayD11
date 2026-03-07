/**
 * Backward-compatible shims that delegate to the shared HorizonService singleton.
 * Existing code can continue importing from "./client" without changes.
 */
import { horizonService } from "./horizonService";
import { Horizon } from "@stellar/stellar-sdk";
import { NetworkConfig } from "./network";

export function getStellarServer(): Horizon.Server {
  return horizonService.getServer();
}

export function getActiveNetworkConfig(): NetworkConfig {
  return horizonService.getConfig();
}

export function resetClient(): void {
  horizonService.reset();
}

