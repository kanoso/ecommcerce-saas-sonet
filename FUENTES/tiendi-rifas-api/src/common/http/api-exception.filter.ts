import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorClass } from '../../modules/raffles/application/use-cases/describe-error';
import { apiErrorOf } from './api-errors';

/** Every error leaves as `{ code, message, details? }` (guide §6.5). */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = apiErrorOf(exception);
    if (status >= 500) {
      // Only the class and code: messages may carry buyer data or
      // connection details.
      this.logger.error(`Unhandled ${errorClass(exception)} answered with ${status}`);
    }
    response.status(status).json(body);
  }
}
