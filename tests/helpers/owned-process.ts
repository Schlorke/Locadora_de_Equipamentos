import { spawn, type ChildProcess } from 'node:child_process'

const exited = (child: ChildProcess) =>
  child.exitCode != null || child.signalCode != null

/** The taskkill command is also ours: observe its termination rather than only requesting it. */
async function stopKiller(
  child: ChildProcess,
  timeoutMs: number
): Promise<void> {
  if (exited(child) || child.pid === undefined) return
  await new Promise<void>((resolve, reject) => {
    let failure: unknown
    const done = () => {
      clearTimeout(timer)
      child.removeListener('exit', done)
      child.removeListener('close', done)
      child.removeListener('error', onError)
      resolve()
    }
    const onError = (error: Error) => {
      failure = error
    }
    const timer = setTimeout(() => {
      child.removeListener('exit', done)
      child.removeListener('close', done)
      child.removeListener('error', onError)
      reject(
        new Error(
          `Owned taskkill process ${child.pid} did not exit within ${timeoutMs}ms`,
          { cause: failure }
        )
      )
    }, timeoutMs)
    child.once('exit', done)
    child.once('close', done)
    child.on('error', onError)
    try {
      if (!child.kill('SIGKILL'))
        failure = new Error('Owned taskkill kill request returned false')
    } catch (error) {
      failure = error
    }
    if (exited(child)) done()
  })
}

/** Try every local cleanup in order, then propagate all failures instead of abandoning sibling resources. */
export async function cleanupOwnedResources(
  actions: readonly (() => unknown | Promise<unknown>)[],
  label = 'Owned fixture cleanup failed'
): Promise<void> {
  const errors: unknown[] = []
  for (const action of actions) {
    try {
      await action()
    } catch (error) {
      errors.push(...(error instanceof AggregateError ? error.errors : [error]))
    }
  }
  if (errors.length) throw new AggregateError(errors, label)
}

/**
 * Stop only a child spawned by the calling fixture. No PID lookup, port lookup or image-name kill.
 * Success requires the child's exit/close event (or an already observed exit), not a successful kill request.
 */
export async function stopOwnedProcess(
  child: ChildProcess | null | undefined,
  { graceMs = 10_000, timeoutMs = 15_000 } = {}
): Promise<void> {
  if (!child || exited(child) || child.pid === undefined) return
  const pid = child.pid
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid)
    throw new Error('Refusing to stop an invalid owned child process')
  if (
    !Number.isSafeInteger(graceMs) ||
    graceMs < 0 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= graceMs
  )
    throw new Error(
      'Owned process timeout must exceed its nonnegative grace period'
    )

  await new Promise<void>((resolve, reject) => {
    const windows = process.platform === 'win32'
    let targetExited = false
    let killer: ChildProcess | undefined
    let killerFinished = false
    let settled = false
    let graceTimer: ReturnType<typeof setTimeout> | undefined
    const hasExited = () => targetExited || exited(child)

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      clearTimeout(graceTimer)
      child.removeListener('exit', onExit)
      child.removeListener('close', onExit)
      child.removeListener('error', onChildError)
      void (async () => {
        try {
          if (killer && !killerFinished && !exited(killer))
            await stopKiller(killer, Math.min(timeoutMs, 1_000))
        } catch (killerError) {
          reject(
            new AggregateError(
              [...(error ? [error] : []), killerError],
              `Owned process ${pid} shutdown failed`
            )
          )
          return
        }
        if (error) reject(error)
        else resolve()
      })()
    }
    const onExit = () => {
      targetExited = true
      if (!windows || killerFinished) finish()
    }
    const onChildError = (error: Error) => {
      if (hasExited()) {
        if (!windows || killerFinished) finish()
      } else
        finish(
          new Error(`Could not stop owned process ${pid}`, { cause: error })
        )
    }
    const deadline = setTimeout(() => {
      finish(
        new Error(
          `Owned process ${pid} did not finish shutdown within ${timeoutMs}ms`
        )
      )
    }, timeoutMs)
    child.once('exit', onExit)
    child.once('close', onExit)
    child.once('error', onChildError)

    try {
      // Install observers before signalling so synchronous exits and fast children cannot be missed.
      if (hasExited()) {
        finish()
        return
      }
      if (windows) {
        killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        killer.once('error', (error) => {
          killerFinished = true
          finish(
            hasExited()
              ? undefined
              : new Error(`Could not run taskkill for owned process ${pid}`, {
                  cause: error,
                })
          )
        })
        killer.once('close', (code) => {
          killerFinished = true
          if (hasExited()) finish()
          else if (code !== 0)
            finish(
              new Error(
                `taskkill failed for owned process ${pid} (exit code: ${code})`
              )
            )
          // Exit 0 only confirms the request. The owned child must still actually terminate.
        })
      } else {
        graceTimer = setTimeout(() => {
          if (hasExited()) {
            finish()
            return
          }
          try {
            child.kill('SIGKILL')
          } catch (error) {
            finish(
              hasExited()
                ? undefined
                : new Error(`Could not force-stop owned process ${pid}`, {
                    cause: error,
                  })
            )
          }
        }, graceMs)
        child.kill('SIGTERM')
      }
    } catch (error) {
      finish(
        hasExited()
          ? undefined
          : new Error(`Could not stop owned process ${pid}`, { cause: error })
      )
    }
  })
}
