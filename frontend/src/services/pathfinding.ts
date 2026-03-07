import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api';

export interface PathRecord {
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_amount: string;
  path: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

export const pathfindingService = {
  fetchCrossAssetPaths: async (
    sourceAsset: string,
    sourceAmount: string,
    destAssets: string
  ): Promise<PathRecord[]> => {
    try {
      const response = await axios.get<{ paths: PathRecord[] }>(`${API_BASE_URL}/payments/paths`, {
        params: {
          sourceAsset,
          sourceAmount,
          destAssets,
        },
      });
      return response.data.paths || [];
    } catch (error) {
      console.error('Error fetching cross-asset paths:', error);
      throw error;
    }
  },
};
