import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * .github/workflows/ci.yml: the ratchet guard compares each push to main/develop with github.event.before, so
 * no push run may be cancelled (not even while pending, which GitHub does to any older pending run of the same
 * concurrency group); pull requests may replace their running check. Every dedicated test suite runs in CI.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const workflow = fs
  .readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
  .replace(/\r\n/g, '\n')
const cronWorkflow = fs
  .readFileSync(path.join(ROOT, '.github/workflows/cron-dispatch.yml'), 'utf8')
  .replace(/\r\n/g, '\n')
const scripts: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
).scripts

type Context = Record<string, string>
type Value = string | boolean

/** Evaluates the subset of GitHub expressions used here: context paths, 'literals', ==, &&, || and grouping. */
function evaluate(expression: string, context: Context): Value {
  const tokens =
    expression.match(/'[^']*'|==|&&|\|\||[A-Za-z_][\w.]*|\S/g) ?? []
  let index = 0
  const primary = (): Value => {
    const token = tokens[index++]
    if (token === undefined) throw new Error(`unexpected end of ${expression}`)
    if (token === '(') {
      const value = or()
      if (tokens[index++] !== ')')
        throw new Error(`unclosed group in ${expression}`)
      return value
    }
    if (token.startsWith("'")) return token.slice(1, -1)
    if (!/^[A-Za-z_]/.test(token))
      throw new Error(`unsupported token ${token} in ${expression}`)
    if (!(token in context)) throw new Error(`unknown context ${token}`)
    return context[token]!
  }
  const comparison = (): Value => {
    const left = primary()
    if (tokens[index] !== '==') return left
    index++
    return left === primary()
  }
  const and = (): Value => {
    let value = comparison()
    while (tokens[index] === '&&') {
      index++
      const right = comparison()
      value = value ? right : value
    }
    return value
  }
  const or = (): Value => {
    let value = and()
    while (tokens[index] === '||') {
      index++
      const right = and()
      value = value ? value : right
    }
    return value
  }
  const result = or()
  if (index !== tokens.length)
    throw new Error(`unsupported expression ${expression}`)
  return result
}

/** A workflow value: a single `${{ }}` expression keeps its type; text interpolates each expression. */
function resolve(value: string, context: Context): Value {
  const text = value.trim()
  const single = /^\$\{\{((?:(?!\}\}).)*)\}\}$/.exec(text)
  if (single) return evaluate(single[1]!, context)
  return text.replace(
    /\$\{\{((?:(?!\}\}).)*)\}\}/g,
    (_match, expression: string) => String(evaluate(expression, context))
  )
}

function concurrency(context: Context) {
  const block = /^concurrency:\n((?:[ \t]+\S.*\n)+)/m.exec(workflow)?.[1]
  expect(block, 'top-level concurrency block').toBeDefined()
  const field = (name: string) =>
    new RegExp(`^\\s+${name}:\\s*(.+)$`, 'm').exec(block!)?.[1]
  const group = resolve(field('group') ?? '', context)
  const cancel = resolve(field('cancel-in-progress') ?? 'false', context)
  return { group, cancel: cancel === true || cancel === 'true' }
}

const run = (
  event: 'push' | 'pull_request',
  ref: string,
  runId: string
): Context => ({
  'github.workflow': 'Workspace validation',
  'github.event_name': event,
  'github.ref': ref,
  'github.run_id': runId,
  'github.sha': 'same-head-sha',
  'github.head_ref': event === 'pull_request' ? 'feature' : '',
})

const CRON_SCHEDULES = {
  hourly: '0 * * * *',
  verify_boleto: '0 */6 * * *',
  boleto_overdue_alerts: '0 9 * * *',
  preventive_maintenance: '0 2 * * *',
}

/** Read actual job expressions, including YAML folding inside the quoted cron string. */
function cronConditions(): Record<string, string> {
  const jobs = /^jobs:\n([\s\S]*)$/m.exec(cronWorkflow)?.[1]
  if (!jobs) throw new Error('cron-dispatch.yml has no jobs block')
  return Object.fromEntries(
    [...jobs.matchAll(/^ {2}([\w-]+):\n((?:(?: {3,}.*)?\n)+)/gm)].map(
      (match) => {
        const condition = /^ {4}if: >-\n((?: {6}.*\n)+)/m.exec(match[2]!)?.[1]
        if (!condition)
          throw new Error(`cron job ${match[1]} has no folded condition`)
        return [
          match[1]!,
          condition
            .trim()
            .split('\n')
            .map((line) => line.trim())
            .join(' '),
        ]
      }
    )
  )
}

const cronRun = (
  event: 'schedule' | 'workflow_dispatch' | 'push',
  schedule: string,
  enabled: string | undefined,
  repository = 'Schlorke/Locadora_de_Equipamentos'
): Context => ({
  'github.repository': repository,
  'github.event_name': event,
  'github.event.schedule': schedule,
  // An unset GitHub repository variable resolves to the empty string.
  'vars.CRON_DISPATCH_ENABLED': enabled ?? '',
})

function ratchetBaseScript(): string {
  const step =
    /^ {6}- name: Ratchet baselines anchored to the base\n((?:(?: {8,}.*)?\n)+)/m.exec(
      workflow
    )?.[1]
  const script = step && /^ {8}run: \|\n((?:(?: {10}.*)?\n)+)/m.exec(step)?.[1]
  if (!script) throw new Error('CI has no ratchet base-selection script')
  return script
    .split('\n')
    .map((line) => line.replace(/^ {10}/, ''))
    .join('\n')
}

/** Remove only this test's scratch, unlinking replacement links without following them. */
function removeCIFixture(directory: string) {
  const relative = path.relative(fs.realpathSync(os.tmpdir()), directory)
  if (
    !relative.startsWith('locadora-ci-base-') ||
    relative.includes(path.sep)
  ) {
    throw new Error('Refusing to remove an unowned CI fixture')
  }
  const remove = (target: string) => {
    const entry = fs.lstatSync(target)
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      for (const child of fs.readdirSync(target))
        remove(path.join(target, child))
      fs.rmdirSync(target)
    } else {
      if (!entry.isSymbolicLink()) fs.chmodSync(target, 0o600)
      fs.unlinkSync(target)
    }
  }
  remove(directory)
}

describe('.github/workflows/ci.yml', () => {
  it('is valid YAML (GitHub rejects the whole workflow otherwise, and no job runs)', async () => {
    // Prettier's YAML parser (the `yaml` package) is strict: e.g. a plain scalar holding ": " fails.
    const { format } = await import('prettier')
    await expect(format(workflow, { parser: 'yaml' })).resolves.toEqual(
      expect.any(String)
    )
  })

  it('never cancels or supersedes a push run, so every push reaches the ratchet guard', () => {
    const first = concurrency(run('push', 'refs/heads/main', '101'))
    const second = concurrency(run('push', 'refs/heads/main', '102'))
    expect(first.cancel).toBe(false)
    expect(second.cancel).toBe(false)
    // Different groups: a newer push can neither cancel nor replace the pending run of an older one.
    expect(first.group).not.toBe(second.group)
  })

  it('lets a newer push to a pull request replace its running check', () => {
    const first = concurrency(run('pull_request', 'refs/pull/7/merge', '201'))
    const second = concurrency(run('pull_request', 'refs/pull/7/merge', '202'))
    expect(first.cancel).toBe(true)
    expect(first.group).toBe(second.group)
    expect(
      concurrency(run('pull_request', 'refs/pull/8/merge', '203')).group
    ).not.toBe(first.group)
  })

  it('compares a push with the commit before it and a pull request with its base branch', () => {
    expect(workflow).toMatch(/PUSH_BEFORE: \$\{\{ github\.event\.before \}\}/)
    expect(workflow).toMatch(/base="origin\/\$PR_BASE"/)
    expect(workflow).toMatch(/RATCHET_BASE_REF="\$base" pnpm ratchet:guard/)
  })

  it.each([
    {
      name: 'first commit without a previous push',
      commits: 1,
      event: 'push',
      before: '',
      expected: 'HEAD',
    },
    {
      name: 'existing parent with an all-zero previous push',
      commits: 2,
      event: 'push',
      before: 'zero',
      expected: 'HEAD^',
    },
    {
      name: 'valid earlier push before the immediate parent',
      commits: 3,
      event: 'push',
      before: 'first',
      expected: 'first',
    },
    {
      name: 'pull request with a literal origin base',
      commits: 1,
      event: 'pull_request',
      before: 'first',
      expected: 'origin/main',
    },
  ])(
    'selects the real Git base for $name without invoking the gate',
    ({ commits, event, before, expected }) => {
      const directory = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), 'locadora-ci-base-')
      )
      try {
        const config = path.join(directory, 'empty-gitconfig')
        const template = path.join(directory, 'empty-template')
        fs.writeFileSync(config, '')
        fs.mkdirSync(template)
        const env: NodeJS.ProcessEnv = {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))
          ),
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: config,
          GIT_CEILING_DIRECTORIES: path.dirname(directory),
          GIT_NO_REPLACE_OBJECTS: '1',
        }
        const git = (...args: string[]) =>
          execFileSync(
            'git',
            [
              '-c',
              'user.name=CI fixture',
              '-c',
              'user.email=fixture@example.test',
              '-c',
              'core.autocrlf=false',
              '-c',
              'commit.gpgsign=false',
              '-c',
              `core.hooksPath=${template}`,
              ...args,
            ],
            { cwd: directory, env, encoding: 'utf8', timeout: 10000 }
          ).trim()
        git('init', '--initial-branch=main', `--template=${template}`)
        const revisions: string[] = []
        for (let index = 0; index < commits; index++) {
          fs.writeFileSync(
            path.join(directory, 'proof.txt'),
            `snapshot ${index}\n`
          )
          git('add', '--', 'proof.txt')
          git('commit', '-m', `fixture ${index}`)
          revisions.push(git('rev-parse', 'HEAD'))
        }
        git('update-ref', 'refs/remotes/origin/main', revisions[0]!)
        // Keep the workflow's shell block intact. Only its terminal pnpm call is replaced by this probe.
        const probe =
          'pnpm() { [ "$#" = "1" ] && [ "$1" = "ratchet:guard" ] || return 91; printf "CI_BASE_PROBE=%s\\n" "$RATCHET_BASE_REF"; }\n'
        const bash =
          process.platform === 'win32'
            ? path.resolve(git('--exec-path'), '../../../bin/bash.exe')
            : 'bash'
        const selectBase = () => {
          const output = execFileSync(
            bash,
            [
              '--noprofile',
              '--norc',
              '-e',
              '-o',
              'pipefail',
              '-c',
              probe + ratchetBaseScript(),
            ],
            {
              cwd: directory,
              env: {
                ...env,
                EVENT_NAME: event,
                PR_BASE: 'main',
                PUSH_BEFORE:
                  before === 'zero'
                    ? '0'.repeat(40)
                    : before === 'first'
                      ? revisions[0]
                      : '',
              },
              encoding: 'utf8',
              timeout: 10000,
            }
          )
          const selected = [...output.matchAll(/^CI_BASE_PROBE=(.+)$/gm)].map(
            (match) => match[1]!
          )
          expect(selected).toHaveLength(1)
          return selected[0]!
        }
        const selected = selectBase()
        if (expected === 'origin/main') expect(selected).toBe('origin/main')
        else
          expect(git('rev-parse', '--verify', selected)).toBe(
            expected === 'first'
              ? revisions[0]
              : git('rev-parse', '--verify', expected)
          )
        if (expected === 'HEAD') {
          expect(git('diff', '--name-only', selected, 'HEAD')).toBe('')
          fs.writeFileSync(
            path.join(directory, 'proof.txt'),
            'follow-up change\n'
          )
          git('add', '--', 'proof.txt')
          git('commit', '-m', 'fixture after seed')
          const next = selectBase()
          expect(git('rev-parse', '--verify', next)).toBe(revisions[0])
          expect(git('diff', '--name-only', next, 'HEAD')).toBe('proof.txt')
        } else if (expected === 'HEAD^') {
          expect(git('diff', '--name-only', selected, 'HEAD')).toBe('proof.txt')
        }
      } finally {
        removeCIFixture(directory)
      }
    }
  )

  it('builds the shared API image and proves /api/health 200 under a non-root user (onda 135, C3)', () => {
    // The job body: from its key under `jobs:` to the next job key (two-space indentation).
    const job = /^ {2}api-docker:\n((?:(?: {3,}.*)?\n)+)/m.exec(workflow)?.[1]
    expect(job, 'jobs.api-docker').toBeDefined()
    // Workspace root as the build context (the Dockerfile copies the whole workspace and builds the API filter).
    expect(job).toMatch(
      /docker build --file apps\/services\/api\/Dockerfile --tag gb-locacoes-api:ci \.\n/
    )
    expect(job).toMatch(
      /docker run --detach --name api --network host[\s\S]*gb-locacoes-api:ci\n/
    )
    const success =
      /if \[ "\$status" = "200" \]; then\n([\s\S]*?)\n\s+fi\n/.exec(job!)?.[1]
    expect(job).toMatch(/curl [^\n]*http:\/\/127\.0\.0\.1:3002\/api\/health/)
    // The non-root assertion runs before the job reports success: `test` fails the step (bash -e) otherwise.
    expect(success).toMatch(
      /test "\$\(docker exec api id -u\)" != "0"\n\s+exit 0$/
    )
    const dockerfile = fs.readFileSync(
      path.join(ROOT, 'apps/services/api/Dockerfile'),
      'utf8'
    )
    expect(dockerfile).toMatch(/^USER node$/m)
    expect(dockerfile).toMatch(/^EXPOSE 3002$/m)
    // The root image job stays until the root is retired (plano da onda 135, Bloco F).
    expect(workflow).toMatch(/^ {2}docker:\n/m)
  })

  it('runs every dedicated vitest suite of package.json', () => {
    const suites = Object.entries(scripts)
      .filter(
        ([name, command]) =>
          name.startsWith('test:') &&
          /^vitest\b/.test(command) &&
          /--config\b/.test(command)
      )
      .map(([name]) => name)
    expect(suites).toContain('test:contract')
    const invoked = new Set(
      [...workflow.matchAll(/^\s+(?:- )?run: pnpm (test:[\w-]+)\s*$/gm)].map(
        (match) => match[1]
      )
    )
    expect(suites.filter((name) => !invoked.has(name))).toEqual([])
  })

  it('runs the test of every gate tool in test:gates (the job without a database), finding 129', () => {
    const read = (file: string) =>
      fs.readFileSync(path.join(ROOT, file), 'utf8')
    // Gate tools: the tools/ modules the CI scripts run (test suites aside), the linter plugins those scripts load
    // (eslint.config.js for `lint`, .stylelintrc.json for `lint:css`) and what they import from tools/.
    const ciScripts = new Set(
      [...workflow.matchAll(/\bpnpm ([a-z][\w:-]*)/g)]
        .map((match) => match[1]!)
        .filter((name) => name in scripts && !name.startsWith('test:'))
    )
    const pending = [...ciScripts].flatMap((name) =>
      [...scripts[name]!.matchAll(/\btools\/[\w.-]+\.mjs\b/g)].map(
        (match) => match[0]
      )
    )
    if (ciScripts.has('lint'))
      pending.push(
        ...[
          ...read('eslint.config.js').matchAll(
            /from ['"]\.\/(tools\/[\w.-]+\.mjs)['"]/g
          ),
        ].map((match) => match[1]!)
      )
    if (ciScripts.has('lint:css'))
      pending.push(
        ...(JSON.parse(read('.stylelintrc.json')).plugins as string[]).map(
          (plugin) => path.posix.normalize(plugin)
        )
      )
    const tools = new Set<string>()
    for (let tool = pending.pop(); tool !== undefined; tool = pending.pop()) {
      if (tools.has(tool)) continue
      tools.add(tool)
      for (const match of read(tool).matchAll(
        /(?:from|import\()\s*['"]\.\/([\w.-]+\.mjs)['"]/g
      ))
        pending.push(`tools/${match[1]}`)
    }
    expect([...tools]).toEqual(
      expect.arrayContaining([
        'tools/arch-check.mjs',
        'tools/ratchet-guard.mjs',
        'tools/eslint-runtime-rewrite.mjs',
        'tools/stylelint-css-structure.mjs',
      ])
    )
    const gateTests = fs
      .readdirSync(path.join(ROOT, 'tests/unit'))
      .filter((file) => /\.test\.tsx?$/.test(file))
      .map((file) => `tests/unit/${file}`)
      .filter((file) => {
        const text = read(file)
        return [...tools].some((tool) =>
          new RegExp(`['"/]${tool.replace(/[.]/g, '\\.')}['"]`).test(text)
        )
      })
    const listed = scripts['test:gates']!.split(/\s+/).filter((argument) =>
      argument.startsWith('tests/')
    )
    expect(gateTests).toContain('tests/unit/eslint-runtime-rewrite.test.ts')
    expect(gateTests.filter((file) => !listed.includes(file))).toEqual([])
    // A listed file that no longer exists would silently drop out of the run.
    expect(
      listed.filter((file) => !fs.existsSync(path.join(ROOT, file)))
    ).toEqual([])
  })
})

describe('.github/workflows/cron-dispatch.yml', () => {
  it('guards every dispatch job with an evaluated condition', () => {
    expect(Object.keys(cronConditions()).sort()).toEqual(
      Object.keys(CRON_SCHEDULES).sort()
    )
  })

  describe.each(Object.entries(CRON_SCHEDULES))('%s', (job, schedule) => {
    const allowed = (context: Context) =>
      evaluate(cronConditions()[job]!, context)

    it.each([undefined, '', 'false', 'off', '0'])(
      'refuses unset or disabled opt-in %j before any job step',
      (enabled) => {
        expect(allowed(cronRun('schedule', schedule, enabled))).toBe(false)
        expect(allowed(cronRun('workflow_dispatch', '', enabled))).toBe(false)
      }
    )

    it('refuses the GB repository even with opt-in enabled for manual and scheduled dispatch', () => {
      expect(
        allowed(cronRun('schedule', schedule, 'true', 'Schlorke/GB-Locacoes'))
      ).toBe(false)
      expect(
        allowed(
          cronRun('workflow_dispatch', '', 'true', 'Schlorke/GB-Locacoes')
        )
      ).toBe(false)
    })

    it('allows the intended repository only with opt-in true and its exact schedule or manual dispatch', () => {
      expect(allowed(cronRun('schedule', schedule, 'true'))).toBe(true)
      expect(allowed(cronRun('workflow_dispatch', '', 'true'))).toBe(true)
    })

    it('refuses other jobs schedules and an unregistered schedule', () => {
      const otherSchedules = Object.values(CRON_SCHEDULES).filter(
        (value) => value !== schedule
      )
      for (const other of [...otherSchedules, '5 * * * *', '']) {
        expect(allowed(cronRun('schedule', other, 'true')), other).toBe(false)
      }
    })

    it('refuses a push, whose event payload has no schedule', () => {
      expect(allowed(cronRun('push', '', 'true'))).toBe(false)
    })
  })
})
