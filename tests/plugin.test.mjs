import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (path) => JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8'))
const plugin = readJson('.claude-plugin/plugin.json')

const frontMatter = (path) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(resolve(repositoryRoot, path), 'utf8'))
  assert.ok(match, `${path} has no front matter`)
  return Object.fromEntries(match[1].split('\n').map((line) => {
    const separator = line.indexOf(': ')
    return [line.slice(0, separator), line.slice(separator + ': '.length)]
  }))
}

test('the plugin manifest and its marketplace agree and track the foundation version', () => {
  const marketplace = readJson('.claude-plugin/marketplace.json')

  assert.match(plugin.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.equal(plugin.version, readJson('package.json').version)
  assert.deepEqual(marketplace.plugins.map(({ name, source }) => ({ name, source })), [
    { name: plugin.name, source: './' },
  ])
  assert.ok(marketplace.owner.name.length > 0)
})

test('every hook runs an executable script of the plugin', () => {
  const { hooks } = readJson('hooks/hooks.json')
  const commands = Object.values(hooks).flat().flatMap((entry) => entry.hooks)

  assert.deepEqual(Object.keys(hooks).sort(), ['PreToolUse', 'Stop'])
  assert.equal(hooks.PreToolUse[0].matcher, 'Bash')
  for (const { command, type } of commands) {
    assert.equal(type, 'command')
    const script = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/(hooks\/[a-z-]+\.mjs)"$/.exec(command)
    assert.ok(script, `unexpected hook command: ${command}`)
    assert.ok(statSync(resolve(repositoryRoot, script[1])).mode & 0o100, `${script[1]} is not executable`)
  }
})

test('agents and skills declare the metadata Claude Code loads them by', () => {
  const knownTools = new Set(['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'])
  for (const file of readdirSync(resolve(repositoryRoot, 'agents'))) {
    const meta = frontMatter(`agents/${file}`)
    assert.equal(meta.name, file.replace(/\.md$/, ''))
    assert.ok(meta.description.length > 0)
    for (const tool of JSON.parse(meta.tools)) {
      assert.ok(knownTools.has(tool), `${file} lists unknown tool ${tool}`)
    }
  }
  for (const skill of readdirSync(resolve(repositoryRoot, 'skills'))) {
    const meta = frontMatter(`skills/${skill}/SKILL.md`)
    assert.equal(meta.name, skill)
    assert.ok(meta.description.length > 0 && meta.description.length <= 1024, skill)
  }
})

test('the review skill starts an agent this plugin ships', () => {
  const review = readFileSync(resolve(repositoryRoot, 'skills/review/SKILL.md'), 'utf8')
  const agents = [...review.matchAll(/`([a-z-]+):([a-z-]+)`/g)]

  assert.ok(agents.length > 0)
  for (const [, pluginName, agent] of agents) {
    assert.equal(pluginName, plugin.name)
    assert.ok(existsSync(resolve(repositoryRoot, 'agents', `${agent}.md`)), agent)
  }
})
