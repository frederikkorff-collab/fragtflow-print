// Renderer logic for the settings window. Talks to the main process through
// the `window.fragtflow` bridge exposed by preload.js.
/* global window, document */
const api = window.fragtflow

const $ = (id) => document.getElementById(id)
const els = {
  token: $('token'),
  stationName: $('stationName'),
  printer: $('printer'),
  pollInterval: $('pollInterval'),
  autoLaunch: $('autoLaunch'),
  msg: $('msg'),
  dot: $('dot'),
  statusText: $('statusText'),
  counts: $('counts'),
  test: $('test'),
  save: $('save'),
  refreshPrinters: $('refreshPrinters'),
}

function setMsg(text, kind) {
  els.msg.textContent = text || ''
  els.msg.className = 'msg' + (kind ? ' ' + kind : '')
}

async function loadPrinters(selected) {
  const printers = await api.listPrinters()
  els.printer.innerHTML = ''
  const optDefault = document.createElement('option')
  optDefault.value = ''
  optDefault.textContent = '(Server-standard)'
  els.printer.appendChild(optDefault)
  for (const name of printers) {
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = name
    els.printer.appendChild(opt)
  }
  els.printer.value = selected || ''
}

function renderStatus(s) {
  const configured = !!els.token.value
  const online = s && s.lastPollAt && Date.now() - s.lastPollAt < 30000
  els.dot.className = 'dot' + (online ? ' ok' : s && s.lastError ? ' err' : '')
  els.statusText.textContent = !configured
    ? 'Ikke konfigureret'
    : online
      ? 'Online'
      : s && s.lastError
        ? 'Fejl: ' + s.lastError
        : 'Forbinder…'
  if (s) els.counts.textContent = `Udskrevet ${s.printedCount} · Fejlet ${s.failedCount}`
}

async function init() {
  const s = await api.getSettings()
  els.token.value = s.token || ''
  els.stationName.value = s.stationName || ''
  els.pollInterval.value = Math.round((s.pollInterval || 5000) / 1000)
  els.autoLaunch.checked = !!s.autoLaunch
  await loadPrinters(s.printer)
  renderStatus(await api.getStatus())

  api.onStatus((st) => renderStatus(st))
}

els.refreshPrinters.addEventListener('click', () => loadPrinters(els.printer.value))

els.test.addEventListener('click', async () => {
  setMsg('Tester…', null)
  // Persist token first so the test uses the latest value.
  await api.saveSettings({ token: els.token.value.trim() })
  const r = await api.testConnection()
  setMsg(r.message, r.ok ? 'ok' : 'err')
  renderStatus(await api.getStatus())
})

els.save.addEventListener('click', async () => {
  const patch = {
    token: els.token.value.trim(),
    stationName: els.stationName.value.trim(),
    printer: els.printer.value,
    pollInterval: Math.max(2, Number(els.pollInterval.value) || 5) * 1000,
    autoLaunch: els.autoLaunch.checked,
  }
  await api.saveSettings(patch)
  setMsg('Gemt ✓', 'ok')
  renderStatus(await api.getStatus())
})

init().catch((e) => setMsg(String(e), 'err'))
