import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import log from 'electron-log'
import { SUPABASE_ANON_KEY } from './config'

const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'

/** Download a (possibly signed) PDF URL to a temp file and return its path. */
async function downloadPdf(url: string, jobId: string): Promise<string> {
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  if (!res.ok) throw new Error(`Kunne ikke hente PDF: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const file = path.join(os.tmpdir(), `fragtflow-${jobId}-${Date.now()}.pdf`)
  await fs.writeFile(file, buf)
  return file
}

export type PrinterInfo = { name: string; virtual: boolean }

// Substrings (lower-cased) that identify the virtual/software printers Windows
// (and some apps) install by default — PDF/XPS writers, fax, OneNote, remote
// printing, etc. These are hidden behind a "vis alle" toggle so the real
// physical printer is easy to find. Matching is best-effort by name.
const VIRTUAL_PRINTER_PATTERNS = [
  'pdf', 'xps', 'onenote', 'fax', 'win2image', 'paperport', 'anydesk', 'document writer',
]

function isVirtualPrinter(name: string): boolean {
  const n = name.toLowerCase()
  return VIRTUAL_PRINTER_PATTERNS.some((p) => n.includes(p))
}

/** List installed printers (with a virtual/physical flag) for the settings dropdown. */
export async function listPrinters(): Promise<PrinterInfo[]> {
  try {
    if (isWin) {
      const { getPrinters } = require('pdf-to-printer') as typeof import('pdf-to-printer')
      const printers = await getPrinters()
      return printers.map((p) => ({ name: p.name, virtual: isVirtualPrinter(p.name) }))
    }
    if (isMac) {
      const unix = require('unix-print') as { getPrinters: () => Promise<Array<{ printer: string }>> }
      const printers = await unix.getPrinters()
      return printers.map((p) => ({ name: p.printer, virtual: isVirtualPrinter(p.printer) }))
    }
  } catch (err) {
    log.error('Kunne ikke hente printerliste', err)
  }
  return []
}

/**
 * Print a job's PDF. `printerName` falls back to the OS default when empty.
 * Returns when the spool command resolves.
 */
export async function printPdf(opts: {
  jobId: string
  pdfUrl: string
  copies: number
  printerName: string
}): Promise<void> {
  const { jobId, pdfUrl, copies, printerName } = opts
  const file = await downloadPdf(pdfUrl, jobId)
  const n = Math.max(1, copies || 1)

  try {
    if (isWin) {
      const { print } = require('pdf-to-printer') as typeof import('pdf-to-printer')
      await print(file, {
        printer: printerName || undefined,
        copies: n,
      })
    } else if (isMac) {
      const unix = require('unix-print') as {
        print: (f: string, p?: string, o?: string[]) => Promise<unknown>
      }
      // unix-print has no copies option; loop the spool command.
      for (let i = 0; i < n; i++) {
        await unix.print(file, printerName || undefined)
      }
    } else {
      throw new Error(`Udskrivning understøttes ikke på platform: ${process.platform}`)
    }
    log.info(`Job ${jobId} sendt til printer (${printerName || 'standard'}) x${n}`)
  } finally {
    // Best-effort temp cleanup.
    fs.unlink(file).catch(() => undefined)
  }
}
