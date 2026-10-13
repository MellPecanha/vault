import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import {
  InsufficientCoinsError,
  InvalidPlayerIdentifierError,
  PrizeAlreadySettledError,
  ResultNotFoundError,
} from '../../application/game';

@Catch(InvalidPlayerIdentifierError, InsufficientCoinsError, ResultNotFoundError, PrizeAlreadySettledError)
export class GameExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    const status = exception instanceof InvalidPlayerIdentifierError
      ? HttpStatus.BAD_REQUEST
      : exception instanceof ResultNotFoundError
        ? HttpStatus.NOT_FOUND
        : exception instanceof PrizeAlreadySettledError
          ? HttpStatus.CONFLICT
          : HttpStatus.UNPROCESSABLE_ENTITY;

    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
