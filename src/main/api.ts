import log from 'electron-log'
import { SUPABASE_ANON_KEY } from './config'
import { getSettings } from './store'

export type PrintJob = {
  id: string
  pdf_url: string
  document_type: string | null
  copies: number | null
  /** Human-friendly label (e.g. "Frederik Korff · 08509…") for the status list. */
  label: string | null
}

export type PollResult = {
  jobs: PrintJob[]
  /** Default printer name the server has on file for this client. */
  printer: string | null
}

function buildUrl(): string {
  const { apiUrl, token } = getSettings()
  return `${apiUrl}?token=${encodeURIComponent(token)}`
}

function headers(): Record<string, string> {
  // The anon key gets us past the Supabase gateway; the token (in the query
  // string, per the function's protocol) is the actual print-client auth.
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Poll for pending jobs. The backend atomically marks returned jobs as
 * 'printing', so each job is handed to exactly one client. A GET also updates
 * the client's last_seen_at (heartbeat).
 */
export async function poll(): Promise<PollResult> {
  const { token } = getSettings()
  if (!token) throw new Error('Ingen token konfigureret')

  const res = await fetch(buildUrl(), { method: 'GET', headers: headers() })
  if (res.status === 401) throw new Error('Token afvist (401) — tjek at print-klienten er aktiv')
  if (!res.ok) throw new Error(`Poll fejlede: HTTP ${res.status}`)

  const data = (await res.json()) as PollResult
  return { jobs: data.jobs ?? [], printer: data.printer ?? null }
}

/** Report a job's terminal status back to the queue. */
export async function reportJob(jobId: string, status: 'printed' | 'failed'): Promise<void> {
  const res = await fetch(buildUrl(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ job_id: jobId, status }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Kunne ikke rapportere job ${jobId} (${status}): HTTP ${res.status} ${text}`)
  }
}

/** Lightweight heartbeat (PUT) used when idle so the station shows online. */
export async function heartbeat(): Promise<void> {
  try {
    await fetch(buildUrl(), { method: 'PUT', headers: headers() })
  } catch (err) {
    log.warn('Heartbeat fejlede', err)
  }
}

/** Quick connectivity check used by the settings UI. */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { printer } = await poll()
    return { ok: true, message: printer ? `Forbundet. Server-printer: ${printer}` : 'Forbundet.' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
