import sensible from '@fastify/sensible'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'

import type { AppConfig } from './config.ts'
import { greetingRoutes } from './features/greetings/routes.ts'
import { healthRoutes } from './features/health/routes.ts'
import { errorHandlerPlugin } from './plugins/error-handler.ts'
import { enforceRouteContract } from './plugins/route-contracts.ts'
import { securityPlugin } from './plugins/security.ts'

export type BuildAppOptions = {
  config: AppConfig
  logger?: boolean | FastifyBaseLogger
}

export type App = FastifyInstance & { config: AppConfig }

const redactedLogFields = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
]

export const buildApp = async ({
  config,
  logger = true,
}: BuildAppOptions): Promise<App> => {
  const app = Fastify({
    bodyLimit: config.BODY_LIMIT,
    logger: logger === true
      ? { level: config.LOG_LEVEL, redact: redactedLogFields }
      : logger,
    trustProxy: config.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.decorate('config', config)
  // Added before any plugin so it sees every route, including encapsulated ones.
  app.addHook('onRoute', enforceRouteContract)

  await app.register(sensible)
  await app.register(securityPlugin, { config })
  await app.register(errorHandlerPlugin)
  await app.register(healthRoutes)
  await app.register(greetingRoutes)

  return app as App
}
