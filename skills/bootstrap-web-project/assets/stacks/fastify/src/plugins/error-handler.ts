import type { FastifyError } from 'fastify'
import fp from 'fastify-plugin'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'

import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
} from '../http.constants.ts'

type ErrorResponse = {
  error: {
    code: string
    message: string
    issues?: { path: string, message: string }[]
  }
}

// Fastify types `code` as required, but errors raised by `reply.notFound()`
// and similar helpers omit it at runtime.
type HandledError = Omit<FastifyError, 'code'> & { code?: string }

const internalError: ErrorResponse = {
  error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
}

/**
 * Every failure leaves the process with the same stable shape. Client faults
 * keep their status and a safe message; unexpected faults are logged with
 * full context and answered generically.
 */
export const errorHandlerPlugin = fp(
  (app, _options, done) => {
    app.setNotFoundHandler((_request, reply) => {
      return reply.code(HTTP_NOT_FOUND).send({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      } satisfies ErrorResponse)
    })

    app.setErrorHandler((error: HandledError, request, reply) => {
      if (hasZodFastifySchemaValidationErrors(error)) {
        return reply.code(HTTP_BAD_REQUEST).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: `Invalid request ${error.validationContext ?? 'input'}`,
            issues: error.validation.map((issue) => ({
              path: issue.instancePath,
              message: issue.message ?? 'Invalid value',
            })),
          },
        } satisfies ErrorResponse)
      }

      if (isResponseSerializationError(error)) {
        request.log.error({ err: error }, 'response does not match its schema')
        return reply.code(HTTP_INTERNAL_SERVER_ERROR).send(internalError)
      }

      const { statusCode } = error

      if (
        statusCode !== undefined
        && statusCode >= HTTP_BAD_REQUEST
        && statusCode < HTTP_INTERNAL_SERVER_ERROR
      ) {
        return reply.code(statusCode).send({
          error: { code: error.code ?? 'REQUEST_ERROR', message: error.message },
        } satisfies ErrorResponse)
      }

      request.log.error({ err: error }, 'unhandled error')
      return reply.code(HTTP_INTERNAL_SERVER_ERROR).send(internalError)
    })

    done()
  },
  { name: 'error-handler' },
)
