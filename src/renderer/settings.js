// Renderer logic for the app window. Talks to the main process through the
// `window.fragtflow` bridge exposed by preload.js. Two views: a Status view
// (connection + counts + recent print requests) and a Settings form.
/* global window, document */
const api = window.fragtflow

const $ = (id) => document.getElementById(id)
const els = {
  // views
  statusView: $('statusView'),
  settingsView: $('settingsView'),
  gotoSettings: $('gotoSettings'),
  gotoStatus: $('gotoStatus'),
  // status view
  stationSub: $('stationSub'),
  dot: $('dot'),
  statusText: $('statusText'),
  counts: $('counts'),
  printingBox: $('printingBox'),
  printingText: $('printingText'),
  jobList: $('jobList'),
  jobsEmpty: $('jobsEmpty'),
  // settings form
  token: $('token'),
  stationName: $('stationName'),
  printer: $('printer'),
  pollInterval: $('pollInterval'),
  autoLaunch: $('autoLaunch'),
  msg: $('msg'),
  test: $('test'),
  save: $('save'),
  refreshPrinters: $('refreshPrinters'),
  showAllPrinters: $('showAllPrinters'),
}

// Cache of the last fetched printer list ([{ name, virtual }]).
let allPrinters = []
// Latest known settings (kept so the Status view can show the station name).
let currentSettings = null

function setMsg(text, kind) {
  els.msg.textContent = text || ''
  els.msg.className = 'msg' + (kind ? ' ' + kind : '')
}

// ---- View switching ----
function showStatusView() {
  els.statusView.classList.remove('hidden')
  els.settingsView.classList.add('hidden')
}

function showSettingsView() {
  els.settingsView.classList.remove('hidden')
  els.statusView.classList.add('hidden')
  // "Tilbage" only makes sense once a token exists (else there's nothing to
  // go back to).
  const hasToken = !!(currentSettings && currentSettings.token)
  els.gotoStatus.classList.toggle('hidden', !hasToken)
  setMsg('', null)
}

// ---- Printers ----
async function loadPrinters(selected) {
  allPrinters = await api.listPrinters()
  // If the currently-selected printer is a virtual one, auto-show all so it
  // stays visible and the toggle reflects reality.
  const selectedIsVirtual = allPrinters.some((p) => p.name === selected && p.virtual)
  if (selectedIsVirtual) els.showAllPrinters.checked = true
  renderPrinterOptions(selected)
}

function renderPrinterOptions(selected) {
  const showAll = els.showAllPrinters.checked
  const sel = selected || ''
  els.printer.innerHTML = ''
  const optDefault = document.createElement('option')
  optDefault.value = ''
  optDefault.textContent = '(Server-standard)'
  els.printer.appendChild(optDefault)
  for (const p of allPrinters) {
    // Hide virtual printers unless "vis alle" is on — but never hide the one
    // that's currently selected, so the saved value is never silently lost.
    if (p.virtual && !showAll && p.name !== sel) continue
    const opt = document.createElement('option')
    opt.value = p.name
    opt.textContent = p.virtual ? `${p.name} (virtuel)` : p.name
    els.printer.appendChild(opt)
  }
  els.printer.value = sel
}

// ---- Status rendering ----
const BADGE_LABEL = { printed: 'Udskrevet', pending: 'Afventer', failed: 'Fejlet' }

function renderStatus(s) {
  const configured = !!(currentSettings && currentSettings.token)
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

  // Station name in the sub-heading.
  if (currentSettings && currentSettings.stationName) {
    els.stationSub.textContent = 'Station: ' + currentSettings.stationName
  } else {
    els.stationSub.textContent = 'Udskriver fragtlabels automatisk.'
  }

  renderPrinting(s)
  renderJobs(s)
}

function renderPrinting(s) {
  const n = s && s.printing ? s.printing : 0
  if (n > 0) {
    els.printingText.textContent =
      n === 1 ? 'Udskriver 1 label…' : `Udskriver ${n} labels…`
    els.printingBox.classList.remove('hidden')
  } else {
    els.printingBox.classList.add('hidden')
  }
}

function renderJobs(s) {
  const jobs = (s && s.recentJobs) || []
  els.jobList.innerHTML = ''
  if (jobs.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = 'Ingen udskriftsanmodninger endnu.'
    els.jobList.appendChild(li)
    return
  }
  for (const job of jobs) {
    const li = document.createElement('li')
    const name = document.createElement('span')
    name.className = 'jobname'
    name.textContent = job.name
    name.title = job.name
    const badge = document.createElement('span')
    const kind = BADGE_LABEL[job.status] ? job.status : 'pending'
    badge.className = 'badge ' + kind
    badge.textContent = BADGE_LABEL[kind]
    li.appendChild(name)
    li.appendChild(badge)
    els.jobList.appendChild(li)
  }
}

// ---- Init ----
async function init() {
  currentSettings = await api.getSettings()
  els.token.value = currentSettings.token || ''
  els.stationName.value = currentSettings.stationName || ''
  els.pollInterval.value = Math.round((currentSettings.pollInterval || 5000) / 1000)
  els.autoLaunch.checked = !!currentSettings.autoLaunch
  await loadPrinters(currentSettings.printer)

  renderStatus(await api.getStatus())
  api.onStatus((st) => renderStatus(st))

  // Launch view: Status if a token is configured, otherwise Settings.
  if (currentSettings.token) showStatusView()
  else showSettingsView()
}

// ---- View navigation ----
els.gotoSettings.addEventListener('click', () => showSettingsView())
els.gotoStatus.addEventListener('click', () => showStatusView())

// ---- Printers ----
els.refreshPrinters.addEventListener('click', () => loadPrinters(els.printer.value))
els.showAllPrinters.addEventListener('change', () => renderPrinterOptions(els.printer.value))

// ---- Test ----
els.test.addEventListener('click', async () => {
  setMsg('Tester…', null)
  // Persist token first so the test uses the latest value.
  currentSettings = await api.saveSettings({ token: els.token.value.trim() })
  const r = await api.testConnection()
  setMsg(r.message, r.ok ? 'ok' : 'err')
  renderStatus(await api.getStatus())
})

// ---- Save ----
els.save.addEventListener('click', async () => {
  const patch = {
    token: els.token.value.trim(),
    stationName: els.stationName.value.trim(),
    printer: els.printer.value,
    pollInterval: Math.max(2, Number(els.pollInterval.value) || 5) * 1000,
    autoLaunch: els.autoLaunch.checked,
  }
  currentSettings = await api.saveSettings(patch)
  setMsg('Gemt ✓', 'ok')
  renderStatus(await api.getStatus())
  // After saving, if a token is present, leave the form for the Status view.
  if (currentSettings.token) showStatusView()
})

init().catch((e) => setMsg(String(e), 'err'))
