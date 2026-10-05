import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test, { before } from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateProject } from '../skills/bootstrap-web-project/scripts/generate-project.mjs'
import { clearGeneratedDirectory, generatedDirectory } from './helpers/generated-directory.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectDirectory = generatedDirectory('fastify-supabase')
const binary = (name) => resolve(repositoryRoot, 'node_modules/.bin', name)

const run = (command, args) => {
  return execFileSync(command, args, {
    cwd: projectDirectory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

let generated

before(() => {
  clearGeneratedDirectory('fastify-supabase')
  generated = generateProject({
    targetDirectory: projectDirectory,
    projectName: 'foundation-fastify-supabase-fixture',
    profiles: ['fastify', 'supabase'],
    securityLevel: 'R2',
    securityRationale: 'Authenticated users own personal profile data.',
  })
})

test('the Supabase overlay composes onto a backend profile', () => {
  const manifest = JSON.parse(readFileSync(resolve(projectDirectory, 'package.json'), 'utf8'))

  assert.equal(manifest.name, 'foundation-fastify-supabase-fixture')
  assert.ok('dev' in manifest.scripts, 'base profile scripts survive the overlay')
  for (const script of ['db:start', 'db:stop', 'db:reset', 'db:test', 'db:types', 'db:migration:new']) {
    assert.equal(script in manifest.scripts, false, `lightweight profile must not add ${script}`)
  }
  assert.equal(
    manifest.dependencies['@supabase/supabase-js'],
    generated.versions.supabaseDependencies['@supabase/supabase-js'],
  )
  assert.equal('supabase' in manifest.devDependencies, false, 'the CLI is not part of the baseline')
  assert.equal(manifest.dependencies.fastify, generated.versions.fastifyDependencies.fastify)

  const gitignore = readFileSync(resolve(projectDirectory, '.gitignore'), 'utf8')
  assert.match(gitignore, /^dist\/$/m)
  assert.doesNotMatch(gitignore, /^supabase\/\.temp\/$/m)

  const envExample = readFileSync(resolve(projectDirectory, '.env.example'), 'utf8')
  assert.match(envExample, /^PORT=/m)
  assert.match(envExample, /^SUPABASE_SECRET_KEY=$/m)
  assert.match(envExample, /^SUPABASE_PUBLISHABLE_KEY=$/m)
  assert.doesNotMatch(envExample, /sb_secret_|sb_publishable_|eyJ/)

  assert.match(
    readFileSync(resolve(projectDirectory, '.engineering-foundation.yml'), 'utf8'),
    /^profiles: \["fastify","supabase"\]$/m,
  )
  for (const path of ['supabase/config.toml', 'supabase/seed.sql', 'supabase/tests']) {
    assert.equal(existsSync(resolve(projectDirectory, path)), false, `${path} is opt-in tooling`)
  }
})

test('every migrated table enables RLS with explicit grants and policies', () => {
  const migrationsDirectory = resolve(projectDirectory, 'supabase/migrations')
  const migrations = readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql'))

  assert.ok(migrations.length > 0, 'expected at least one migration')

  for (const file of migrations) {
    const sql = readFileSync(resolve(migrationsDirectory, file), 'utf8')
    const tables = [...sql.matchAll(/create table (?:if not exists )?([\w.]+)/gi)].map(
      (match) => match[1],
    )

    for (const table of tables) {
      const escaped = table.replaceAll('.', '\\.')
      assert.match(sql, new RegExp(`alter table ${escaped} enable row level security`, 'i'), `${table} lacks RLS`)
      assert.match(sql, new RegExp(`revoke all on table ${escaped} from anon, authenticated`, 'i'), `${table} keeps default grants`)
      assert.match(sql, new RegExp(`create policy \\w+ on ${escaped}`, 'i'), `${table} has no policy`)
      assert.match(sql, /\(select auth\.uid\(\)\)/, `${table} policies must wrap auth.uid() in a subselect`)
    }
    assert.doesNotMatch(sql, /security definer/i, 'no SECURITY DEFINER function without an explicit review')
  }
})

test('the base profile still passes lint with the overlay applied', () => {
  assert.doesNotThrow(() => run(binary('eslint'), ['.', '--max-warnings=0']))
})
