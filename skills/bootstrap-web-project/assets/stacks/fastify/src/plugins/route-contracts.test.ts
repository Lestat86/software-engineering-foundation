import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { buildTestApp } from '../../test/build-test-app.ts'
import type { App } from '../app.ts'
import { HTTP_OK } from '../http.constants.ts'

const response = { [HTTP_OK]: z.object({ ok: z.boolean() }) }
const handler = (): { ok: boolean } => ({ ok: true })

describe('route contracts', () => {
  let app: App

  beforeEach(async () => {
    app = await buildTestApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('rejects a route without a response schema at registration', () => {
    expect(() => app.get('/unchecked', handler)).toThrow(/must declare a response schema/)
  })

  it('rejects path parameters without a params schema', () => {
    expect(() => app.get('/items/:id', { schema: { response } }, handler))
      .toThrow(/must declare a params schema/)
  })

  it('rejects a body route without a body schema', () => {
    expect(() => app.post('/items', { schema: { response } }, handler))
      .toThrow(/must declare a body schema or a contractException/)
  })

  it('accepts a body route that records why it has no body schema', () => {
    expect(() => app.post(
      '/uploads',
      { config: { contractException: 'Streams the upload; bodyLimit bounds it.' }, schema: { response } },
      handler,
    )).not.toThrow()
  })
})
