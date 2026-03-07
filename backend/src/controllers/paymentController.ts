import type { Request, Response } from 'express';
import { AnchorService } from '../services/anchorService.js';
import { Keypair, Asset } from '@stellar/stellar-sdk';
import { StellarService } from '../services/stellarService.js';

export class PaymentController {
  /**
   * GET /api/payments/anchor-info
   */
  static async getAnchorInfo(req: Request, res: Response) {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domain required' });

    try {
      const info = await AnchorService.getSEP31Info(domain as string);
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/payments/sep31/initiate
   */
  static async initiateSEP31(req: Request, res: Response) {
    const { domain, paymentData, secretKey } = req.body;

    if (!domain || !paymentData || !secretKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const clientKeypair = Keypair.fromSecret(secretKey);

      // 1. Authenticate
      const token = await AnchorService.authenticate(domain as string, clientKeypair);

      // 2. Initiate Payment
      const result = await AnchorService.initiatePayment(domain as string, token, paymentData);

      res.json(result);
    } catch (error: any) {
      console.error('SEP-31 Initiation Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/payments/sep31/status/:domain/:id
   */
  static async getStatus(req: Request, res: Response) {
    const { domain, id } = req.params;
    const { secretKey } = req.query;

    if (!domain || !id || !secretKey) {
      return res.status(400).json({ error: 'Missing required params' });
    }

    try {
      const clientKeypair = Keypair.fromSecret(secretKey as string);
      // Re-auth to get a fresh token or use a session-based approach
      // For simplicity in this implementation, we re-auth
      const token = await AnchorService.authenticate(domain as string, clientKeypair);

      const status = await AnchorService.getTransaction(domain as string, token, id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/payments/paths
   * Proxy to Stellar Horizon strictSendPaths
   */
  static async getCrossAssetPaths(req: Request, res: Response) {
    const { sourceAsset, sourceAmount, destAssets } = req.query;

    if (
      typeof sourceAsset !== 'string' ||
      typeof sourceAmount !== 'string' ||
      typeof destAssets !== 'string'
    ) {
      return res.status(400).json({
        error: 'Missing or invalid query params: sourceAsset, sourceAmount, destAssets must be strings'
      });
    }

    try {
      const server = StellarService.getServer();

      // Parse Source Asset
      let sourceAssetObj: Asset;
      if (sourceAsset === 'XLM') {
        sourceAssetObj = Asset.native();
      } else {
        // Format parsing: CODE:ISSUER
        const parts = sourceAsset.split(':');
        if (parts.length !== 2) throw new Error('Invalid sourceAsset format. Use CODE:ISSUER or XLM');
        sourceAssetObj = new Asset(parts[0] as string, parts[1] as string);
      }

      // Parse Destination Assets
      const destAssetList: Asset[] = destAssets.split(',').map((assetStr) => {
        if (assetStr === 'XLM') return Asset.native();
        const parts = assetStr.split(':');
        if (parts.length !== 2) throw new Error(`Invalid destAsset format: ${assetStr}`);
        return new Asset(parts[0] as string, parts[1] as string);
      });

      // Call Horizon
      const pathsResponse = await server
        .strictSendPaths(sourceAssetObj, sourceAmount, destAssetList)
        .call();

      res.json({
        paths: pathsResponse.records
      });

    } catch (error: any) {
      console.error('Pathfinding Error:', error);
      res.status(500).json({ error: error.message || 'Error fetching conversion paths' });
    }
  }
}
