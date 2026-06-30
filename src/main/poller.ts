import log from 'electron-log'
import { poll, reportJob, heartbeat } from './api'
import { printPdf } from './printer'
import { getSettings } from './store'

export type PollerStatus = {
  running: boolean
  lastPollAt: number | null
  lastError: string | null
  printedCount: number
  failedCount: number
}

const status: PollerStatus = {
  running: false,
  lastPollAt: null,
  lastError: null,
  printedCount: 0,
  failedCount: 0,
}

type Listener = (s: PollerStatus) => void
let listeners: Listener[] = []
let timer: NodeJS.Timeout | null = null
let ticking = false

export function getStatus(): PollerStatus {
  return { ...status }
}

export function onStatusChange(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

function emit() {
  const snapshot = getStatus()
  for (const l of listeners) l(snapshot)
}

async function tick() {
  if (ticking) return
  ticking = true
  const { paused, token, printer } = getSettings()

  try {
    if (paused || !token) {
      // Still heartbeat so the station shows online while idle/paused.
      if (token) await heartbeat()
      return
    }

    const { jobs, printer: serverPrinter } = await poll()
    status.lastPollAt = Date.now()
    status.lastError = null

    for (const job of jobs) {
      try {
        await printPdf({
          jobId: job.id,
          pdfUrl: job.pdf_url,
          copies: job.copies ?? 1,
          printerName: printer || serverPrinter || '',
        })
        await reportJob(job.id, 'printed')
        status.printedCount++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error(`Job ${job.id} fejlede:`, msg)
        status.failedCount++
        status.lastError = msg
        try {
          await reportJob(job.id, 'failed')
        } catch (reportErr) {
          log.error('Kunne ikke rapportere fejlet job', reportErr)
        }
      }
      emit()
    }
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err)
    log.warn('Poll-cyklus fejlede:', status.lastError)
  } finally {
    ticking = false
    emit()
  }
}

export function startPoller() {
  if (status.running) return
  status.running = true
  const schedule = () => {
    const { pollInterval } = getSettings()
    timer = setTimeout(async () => {
      await tick()
      if (status.running) schedule()
    }, Math.max(2000, pollInterval || 5000))
  }
  // Run one immediately, then on the interval.
  tick().finally(schedule)
  emit()
}

export function stopPoller() {
  status.running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  emit()
}
