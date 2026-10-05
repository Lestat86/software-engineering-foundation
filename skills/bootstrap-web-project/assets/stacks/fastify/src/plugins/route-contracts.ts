import type { RouteOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * FASTIFY-SCHEMA-001 exception for a streaming or proxy route that cannot
     * declare a body schema: states why, and how the payload is bounded.
     */
    contractException?: string
  }
}

const BODY_METHODS = new Set(['PATCH', 'POST', 'PUT'])
const PATH_PARAMETER = /\/:\w/

const methodsOf = (method: RouteOptions['method']): string[] =>
  (Array.isArray(method) ? method : [method]).map((name) => name.toUpperCase())

/**
 * FASTIFY-SCHEMA-001: registered as an `onRoute` hook before any route, so a
 * route without its contract fails at startup instead of reaching production.
 * Every route declares its responses, a route with path parameters declares
 * `params`, and a route accepting a body declares `body` unless it records a
 * `contractException`.
 */
export const enforceRouteContract = (route: RouteOptions): void => {
  const methods = methodsOf(route.method)
  const label = `${methods.join(',')} ${route.url}`
  const schema = route.schema ?? {}

  if (schema.response === undefined) {
    throw new Error(`${label} must declare a response schema (FASTIFY-SCHEMA-001)`)
  }
  if (PATH_PARAMETER.test(route.url) && schema.params === undefined) {
    throw new Error(`${label} must declare a params schema (FASTIFY-SCHEMA-001)`)
  }

  const acceptsBody = methods.some((method) => BODY_METHODS.has(method))
  const exception = route.config?.contractException?.trim() ?? ''
  if (acceptsBody && schema.body === undefined && exception === '') {
    throw new Error(
      `${label} must declare a body schema or a contractException (FASTIFY-SCHEMA-001)`,
    )
  }
}
