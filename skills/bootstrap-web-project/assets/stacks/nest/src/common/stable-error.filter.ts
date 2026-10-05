import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'

type ErrorResponse = {
  error: {
    code: string
    message: string
    issues?: string[]
  }
}

const internalError: ErrorResponse = {
  error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
}

const isValidationPayload = (payload: unknown): payload is { message: string[] } => (
  typeof payload === 'object'
  && payload !== null
  && Array.isArray((payload as { message?: unknown }).message)
)

const codeFor = (status: HttpStatus, payload: unknown): string => {
  if (status === HttpStatus.BAD_REQUEST && isValidationPayload(payload)) {
    return 'VALIDATION_FAILED'
  }
  if (status === HttpStatus.TOO_MANY_REQUESTS) {
    return 'RATE_LIMITED'
  }
  // The reverse enum lookup is typed as string but is undefined for statuses
  // outside the enum, such as custom codes raised by middleware.
  const name = HttpStatus[status] as string | undefined
  return name ?? 'REQUEST_ERROR'
}

/**
 * Every failure leaves the process with the same stable shape. Client faults
 * keep their status and a safe message; unexpected faults are logged with
 * full context and answered generically.
 */
@Catch()
export class StableErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(StableErrorFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      const status: HttpStatus = exception.getStatus()

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(exception.message, exception.stack)
        response.status(status).json(internalError)
        return
      }

      const payload = exception.getResponse()
      const body: ErrorResponse = {
        error: {
          code: codeFor(status, payload),
          message: typeof payload === 'string' ? payload : exception.message,
          ...(isValidationPayload(payload) ? { issues: payload.message } : {}),
        },
      }
      response.status(status).json(body)
      return
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown error',
      exception instanceof Error ? exception.stack : undefined,
    )
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(internalError)
  }
}
