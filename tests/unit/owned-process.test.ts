import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  cleanupOwnedResources,
  stopOwnedProcess,
} from '../helpers/owned-process'

vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  spawn: vi.fn(),
}))

let realSpawn: typeof spawn
beforeAll(async () => {
  realSpawn = (
    await vi.importActual<typeof import('node:child_process')>(
      'node:child_process'
    )
  ).spawn
})
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
const nativePlatform = process.platform
const options = { graceMs: 10, timeoutMs: 30 }

function platform(value: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { ...originalPlatform, value })
}

function childProcess(pid = 4242) {
  const child = Object.assign(new EventEmitter(), {
    pid,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill: vi.fn(() => true),
  })
  const exit = (
    code: number | null = 0,
    signal: NodeJS.Signals | null = null
  ) => {
    child.exitCode = code
    child.signalCode = signal
    child.emit('exit', code, signal)
    child.emit('close', code, signal)
  }
  return { child: child as unknown as ChildProcess, kill: child.kill, exit }
}

function commandProcess(pid = 4243) {
  const command = childProcess(pid)
  command.kill.mockImplementation(() => {
    command.exit(null, 'SIGKILL')
    return true
  })
  return command
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(spawn).mockReset()
  platform('win32')
})

afterEach(() => {
  Object.defineProperty(process, 'platform', originalPlatform)
  vi.useRealTimers()
})

describe('owned process shutdown', () => {
  it('tries the next child and every local resource after a child fails; fixture deletion stays blocked', async () => {
    const first = childProcess(4242)
    const second = childProcess(4244)
    const attempted: string[] = []
    vi.mocked(spawn).mockImplementation((_command, args) => {
      const killer = commandProcess(4243)
      queueMicrotask(() => {
        if (args?.includes('4242')) killer.exit(1)
        else {
          second.exit(0)
          killer.exit(0)
        }
      })
      return killer.child
    })
    const discardDatabase = vi.fn()
    const cleanup = async () => {
      await cleanupOwnedResources(
        [
          () => {
            attempted.push('first')
            return stopOwnedProcess(first.child, options)
          },
          () => {
            attempted.push('second')
            return stopOwnedProcess(second.child, options)
          },
          () => {
            attempted.push('provider')
            throw new Error('provider cleanup failed')
          },
          () => {
            attempted.push('logs')
          },
        ],
        'Fixture cleanup failed (child PIDs: 4242, 4244)'
      )
      discardDatabase()
    }
    const error = await cleanup().catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors).toHaveLength(2)
    expect((error as AggregateError).message).toContain('4242, 4244')
    expect(attempted).toEqual(['first', 'second', 'provider', 'logs'])
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(discardDatabase).not.toHaveBeenCalled()
  })

  it('does nothing for an absent, never-started or already terminated child', async () => {
    const { child, exit } = childProcess()
    await stopOwnedProcess(undefined)
    await stopOwnedProcess(null)
    const neverStarted = childProcess().child
    Object.defineProperty(neverStarted, 'pid', { value: undefined })
    await stopOwnedProcess(neverStarted)
    exit(1)
    await stopOwnedProcess(child)
    const signalled = childProcess().child
    Object.defineProperty(signalled, 'signalCode', { value: 'SIGTERM' })
    await stopOwnedProcess(signalled)
    expect(spawn).not.toHaveBeenCalled()
  })

  it.each([0, -1, Number.NaN, process.pid])(
    'refuses unsafe child PID %s',
    async (pid) => {
      await expect(stopOwnedProcess(childProcess(pid).child)).rejects.toThrow(
        /invalid owned child/
      )
      expect(spawn).not.toHaveBeenCalled()
    }
  )

  it('does not report success when taskkill succeeds before the child exits', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    let finished = false
    const pending = stopOwnedProcess(target.child, options).then(() => {
      finished = true
    })
    killer.exit(0)
    await Promise.resolve()
    expect(finished).toBe(false)
    target.exit(null, 'SIGKILL')
    await pending
    expect(finished).toBe(true)
    expect(spawn).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', '4242', '/T', '/F'],
      {
        stdio: 'ignore',
        windowsHide: true,
      }
    )
    expect(target.child.listenerCount('exit')).toBe(0)
    expect(target.child.listenerCount('close')).toBe(0)
  })

  it('rejects taskkill failure while the owned child is still running', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    const rejected = expect(pending).rejects.toThrow(
      /taskkill failed.*exit code: 1/
    )
    killer.exit(1)
    await rejected
    expect(target.kill).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('accepts a failed taskkill only when the owned child has already exited in the race', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    target.exit(0)
    killer.exit(128)
    await expect(pending).resolves.toBeUndefined()
  })

  it('rejects a taskkill spawn error, including asynchronous failure', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    const rejected = expect(pending).rejects.toThrow(/Could not run taskkill/)
    killer.child.emit('error', new Error('ENOENT'))
    await rejected
  })

  it('accepts a taskkill spawn error if the child exited first', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    target.exit(0)
    killer.child.emit('error', new Error('ENOENT'))
    await expect(pending).resolves.toBeUndefined()
  })

  it('rejects a synchronous taskkill spawn exception', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      throw new Error('spawn unavailable')
    })
    await expect(
      stopOwnedProcess(childProcess().child, options)
    ).rejects.toThrow(/Could not stop owned process/)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out when taskkill returns success but the owned child never terminates', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    const rejected = expect(pending).rejects.toThrow(
      /did not finish shutdown within 30ms/
    )
    killer.exit(0)
    await vi.advanceTimersByTimeAsync(30)
    await rejected
    expect(target.child.listenerCount('exit')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds a hung taskkill and stops only the helper command it spawned', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    const rejected = expect(pending).rejects.toThrow(/did not finish shutdown/)
    await vi.advanceTimersByTimeAsync(30)
    await rejected
    expect(killer.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(killer.child.signalCode).toBe('SIGKILL')
    expect(target.kill).not.toHaveBeenCalled()
  })

  it.each(['false', 'throw'])(
    'preserves both errors when stopping a hung taskkill %s and it never exits',
    async (failure) => {
      const target = childProcess()
      const killer = commandProcess()
      killer.kill.mockImplementation(() => {
        if (failure === 'throw') throw new Error('EPERM')
        return false
      })
      vi.mocked(spawn).mockReturnValue(killer.child)
      const pending = stopOwnedProcess(target.child, options)
      const observed = pending.catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(60)
      const error = await observed
      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toHaveLength(2)
      expect((error as AggregateError).errors[0].message).toMatch(
        /did not finish shutdown within 30ms/
      )
      expect((error as AggregateError).errors[1].message).toMatch(
        /Owned taskkill process 4243 did not exit within 30ms/
      )
      expect(killer.child.exitCode).toBeNull()
      expect(killer.child.signalCode).toBeNull()
      expect(killer.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it('propagates a child shutdown error instead of treating it as termination', async () => {
    const target = childProcess()
    const killer = commandProcess(4243)
    vi.mocked(spawn).mockReturnValue(killer.child)
    const pending = stopOwnedProcess(target.child, options)
    const rejected = expect(pending).rejects.toThrow(
      /Could not stop owned process/
    )
    target.child.emit('error', new Error('EPERM'))
    await rejected
    expect(killer.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
  })

  it('observes a synchronous POSIX termination without sending a later force signal', async () => {
    platform('linux')
    const target = childProcess()
    target.kill.mockImplementation(() => {
      target.exit(null, 'SIGTERM')
      return true
    })
    await stopOwnedProcess(target.child, options)
    await vi.advanceTimersByTimeAsync(30)
    expect(target.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
    expect(spawn).not.toHaveBeenCalled()
  })

  it('escalates an unresponsive POSIX child and waits for its actual exit', async () => {
    platform('linux')
    const target = childProcess()
    let finished = false
    const pending = stopOwnedProcess(target.child, options).then(() => {
      finished = true
    })
    expect(target.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM')
    await vi.advanceTimersByTimeAsync(10)
    expect(target.kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
    expect(finished).toBe(false)
    target.exit(null, 'SIGKILL')
    await pending
    expect(finished).toBe(true)
  })

  it('rejects POSIX shutdown that never completes even after escalation', async () => {
    platform('linux')
    const target = childProcess()
    const pending = stopOwnedProcess(target.child, options)
    const rejected = expect(pending).rejects.toThrow(/did not finish shutdown/)
    await vi.advanceTimersByTimeAsync(30)
    await rejected
    expect(target.kill).toHaveBeenNthCalledWith(2, 'SIGKILL')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not treat a thrown POSIX signal error as successful cleanup', async () => {
    platform('linux')
    const target = childProcess()
    target.kill.mockImplementation(() => {
      throw new Error('EPERM')
    })
    await expect(stopOwnedProcess(target.child, options)).rejects.toThrow(
      /Could not stop owned process/
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it('terminates a real owned Node child before resolving, without a server or database', async () => {
    vi.useRealTimers()
    platform(nativePlatform)
    vi.mocked(spawn).mockImplementation(realSpawn)
    const child = realSpawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      {
        stdio: 'ignore',
        env: {},
        windowsHide: true,
      }
    )
    let observedExit = false
    child.once('exit', () => {
      observedExit = true
    })
    try {
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      await stopOwnedProcess(child, { graceMs: 500, timeoutMs: 5_000 })
      expect(observedExit).toBe(true)
      expect(child.exitCode !== null || child.signalCode !== null).toBe(true)
    } finally {
      // Even a deliberate broken-helper mutation must not leave this test's own child alive.
      if (child.exitCode === null && child.signalCode === null) {
        const ended = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Owned Node fixture did not exit')),
            5_000
          )
          child.once('exit', () => {
            clearTimeout(timer)
            resolve()
          })
        })
        child.kill('SIGKILL')
        await ended
      }
    }
  }, 15_000)
})
