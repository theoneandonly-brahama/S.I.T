import { Injectable, Logger } from '@nestjs/common';

/**
 * ConfirmationDeliveryService is the seam between token issuance and the
 * channel that tells the user about it.
 *
 * No mail provider is configured in this prototype:
 * - development: the token is logged so the flow can be exercised locally;
 * - test: delivery is silent (tests capture it through this service);
 * - production: a warning is logged without the token. A real deployment
 *   must replace this class with a mail adapter.
 *
 * Implementations must not throw: callers return the same generic response
 * whether or not an account exists, so a delivery failure must not become an
 * account-enumeration signal.
 */
@Injectable()
export class ConfirmationDeliveryService {
  private readonly logger = new Logger(ConfirmationDeliveryService.name);

  async deliver(email: string, token: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // Never log the token in production. The warning is intentionally
      // generic and contains neither the address nor the token.
      this.logger.warn(
        'Confirmation delivery is not configured; the token was not sent.'
      );
      return;
    }

    if (process.env.NODE_ENV === 'test') {
      // The integration suite observes this method directly; keeping the
      // test run silent avoids printing confirmation tokens in CI logs.
      return;
    }

    this.logger.log(`Confirmation token for ${email}: ${token}`);
  }
}
