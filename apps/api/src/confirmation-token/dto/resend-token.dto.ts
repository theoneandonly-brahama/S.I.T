import { IsEmail } from 'class-validator';

/**
 * ResendTokenDto is the request body for POST /confirmation-token/resend.
 *
 * The endpoint is public, so the address is the only input. The response is
 * always generic; the service decides internally whether a token is issued.
 */
export class ResendTokenDto {
  @IsEmail()
  email: string;
}
