import { z } from 'zod'

import {
  DEFAULT_PORT,
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_MS,
  MAX_TCP_PORT,
  MIN_THROTTLE_TTL_MS,
} from './env.constants'

const originList = z
  .string()
  .default('')
  .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
  .pipe(z.array(z.url({ protocol: /^https?$/ })))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(MAX_TCP_PORT).default(DEFAULT_PORT),
  CORS_ORIGINS: originList,
  THROTTLE_LIMIT: z.coerce.number().int().min(1).default(DEFAULT_THROTTLE_LIMIT),
  THROTTLE_TTL_MS: z.coerce
    .number()
    .int()
    .min(MIN_THROTTLE_TTL_MS)
    .default(DEFAULT_THROTTLE_TTL_MS),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validates the process environment for `ConfigModule`. Fails fast with the
 * offending variable names, never their values.
 */
export const validateEnv = (source: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))]
    throw new Error(`Invalid configuration for: ${names.join(', ')}`)
  }

  return result.data
}
