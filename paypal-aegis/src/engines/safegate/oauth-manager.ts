/**
 * SafeGate OAuth 2.0 Token Lifecycle Manager
 *
 * Manages PayPal sandbox OAuth tokens with automatic renewal.
 * Falls back to mock tokens when PayPal credentials are not configured.
 */

import axios from 'axios';
import { config } from '../../config';
import logger from '../../lib/logger';
import type { PayPalOAuthToken } from '../../types';

export interface ManagedToken {
  token: PayPalOAuthToken;
  expiresAt: number; // epoch ms
  isSimulated: boolean;
}

export class OAuthManager {
  private static instance: OAuthManager | null = null;
  private currentToken: ManagedToken | null = null;
  private renewalTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<ManagedToken> | null = null;

  private constructor() {
    // Singleton — use OAuthManager.getInstance()
  }

  static getInstance(): OAuthManager {
    if (!OAuthManager.instance) {
      OAuthManager.instance = new OAuthManager();
    }
    return OAuthManager.instance;
  }

  /**
   * Returns a valid access token, refreshing if necessary.
   * Thread-safe: concurrent callers share the same in-flight refresh promise.
   */
  async getAccessToken(): Promise<ManagedToken> {
    if (this.currentToken && Date.now() < this.currentToken.expiresAt) {
      return this.currentToken;
    }

    // Coalesce concurrent refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refresh();
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Fetches a fresh token from PayPal or returns a mock token.
   */
  private async refresh(): Promise<ManagedToken> {
    if (!config.paypal.isConfigured) {
      return this.createMockToken();
    }

    try {
      const credentials = Buffer.from(
        `${config.paypal.clientId}:${config.paypal.clientSecret}`
      ).toString('base64');

      const response = await axios.post<PayPalOAuthToken>(
        `${config.paypal.sandboxBaseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10_000,
        }
      );

      const token = response.data;
      const expiresInMs = token.expires_in * 1000;
      const renewBufferMs = 15 * 60 * 1000; // 15 minutes
      const expiresAt = Date.now() + expiresInMs;

      this.currentToken = {
        token,
        expiresAt,
        isSimulated: false,
      };

      this.scheduleRenewal(expiresInMs - renewBufferMs);

      logger.info('OAuth token acquired from PayPal sandbox', {
        expiresIn: token.expires_in,
        scope: token.scope?.substring(0, 80) + '...',
      });

      return this.currentToken;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to acquire OAuth token from PayPal', { error: message });

      // Fallback to mock if live token fetch fails
      logger.warn('Falling back to simulated OAuth token');
      return this.createMockToken();
    }
  }

  /**
   * Creates a mock token for simulation/demo mode.
   */
  private createMockToken(): ManagedToken {
    logger.warn('PayPal credentials not configured — using simulated OAuth token');

    const mockToken: PayPalOAuthToken = {
      access_token: `A21AASimulated_${Date.now()}_aegis_mock_token`,
      token_type: 'Bearer',
      expires_in: 32400, // 9 hours
      scope: 'https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/disputes/read-buyer https://uri.paypal.com/services/payments/realtimepayment',
      nonce: `${Date.now()}-simulated-nonce`,
    };

    this.currentToken = {
      token: mockToken,
      expiresAt: Date.now() + mockToken.expires_in * 1000,
      isSimulated: true,
    };

    // Schedule renewal even for mock tokens so behaviour is consistent
    this.scheduleRenewal((mockToken.expires_in - 15 * 60) * 1000);

    return this.currentToken;
  }

  /**
   * Schedules automatic token renewal before expiry.
   */
  private scheduleRenewal(delayMs: number): void {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
    }

    const safeDelay = Math.max(delayMs, 60_000); // at least 1 minute

    this.renewalTimer = setTimeout(async () => {
      logger.info('Scheduled OAuth token renewal triggered');
      this.currentToken = null; // Force refresh on next call
      try {
        await this.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Scheduled token renewal failed', { error: message });
      }
    }, safeDelay);

    // Don't let the timer prevent process exit
    if (this.renewalTimer.unref) {
      this.renewalTimer.unref();
    }

    logger.debug('Token renewal scheduled', { delayMs: safeDelay });
  }

  /**
   * Invalidates the current token, forcing a refresh on next access.
   */
  invalidate(): void {
    this.currentToken = null;
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
    logger.info('OAuth token invalidated');
  }

  /**
   * Returns whether the current token is simulated.
   */
  isSimulated(): boolean {
    return this.currentToken?.isSimulated ?? true;
  }

  /**
   * Cleanup for testing.
   */
  static resetInstance(): void {
    if (OAuthManager.instance) {
      OAuthManager.instance.invalidate();
      OAuthManager.instance = null;
    }
  }
}

export const oauthManager = OAuthManager.getInstance();
export default oauthManager;
