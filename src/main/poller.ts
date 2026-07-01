import log from 'electron-log'
import { poll, reportJob, heartbeat } from './api'
import { printPdf } from './printer'
import { getSettings } from './store'

export type RecentJobStatus = 'pending' | 'printed' | 'failed'

export type RecentJob = {
  id: string
  name: string
  status: RecentJobStatus
  at: number
}

export type PollerStatus = {
  running: boolean
  lastPollAt: number | null
  lastError: string | null
  printedCount: number
  failedCount: number
  /** How many jobs are being printed in the current cycle (0 = idle). */
  printing: number
  /** Most-recent print requests, newest first (capped). */
  recentJobs: RecentJob[]
}

/** Max number of recent jobs kept in memory / shown in the status list. */
const RECENT_JOBS_CAP = 25

const status: PollerStatus = {
  running: false,
  lastPollAt: null,
  lastError: null,
  printedCount: 0,
  failedCount: 0,
  printing: 0,
  recentJobs: [],
}

/** Human-friendly label for a job. The queue payload only carries id/document_type. */
function jobName(job: { id: string; document_type: string | null }): string {
  return (job.document_type && job.document_type.trim()) || job.id
}

/** Insert or update a recent job entry (keyed by id), newest first, capped. */
function upsertRecentJob(entry: RecentJob) {
  const existingIdx = status.recentJobs.findIndex((j) => j.id === entry.id)
  if (existingIdx !== -1) status.recentJobs.splice(existingIdx, 1)
  status.recentJobs.unshift(entry)
  if (status.recentJobs.length > RECENT_JOBS_CAP) {
    status.recentJobs.length = RECENT_JOBS_CAP
  }
}

function setJobStatus(id: string, next: RecentJobStatus) {
  const job = status.recentJobs.find((j) => j.id === id)
  if (job) {
    job.status = next
    job.at = Date.now()
  }
}

type Listener = (s: PollerStatus) => void
let listeners: Listener[] = []
let timer: NodeJS.Timeout | null = null
let ticking = false

export function getStatus(): PollerStatus {
  return { ...status, recentJobs: status.recentJobs.map((j) => ({ ...j })) }
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

    // Register everything we pulled as pending so the UI shows the queue.
    if (jobs.length > 0) {
      for (const job of jobs) {
        upsertRecentJob({ id: job.id, name: jobName(job), status: 'pending', at: Date.now() })
      }
      status.printing = jobs.length
      emit()
    }

    let remaining = jobs.length
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
        setJobStatus(job.id, 'printed')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error(`Job ${job.id} fejlede:`, msg)
        status.failedCount++
        status.lastError = msg
        setJobStatus(job.id, 'failed')
        try {
          await reportJob(job.id, 'failed')
        } catch (reportErr) {
          log.error('Kunne ikke rapportere fejlet job', reportErr)
        }
      }
      remaining--
      status.printing = remaining
      emit()
    }
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err)
    log.warn('Poll-cyklus fejlede:', status.lastError)
  } finally {
    status.printing = 0
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
