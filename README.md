# FragtFlow Print Client

A lightweight cross-platform desktop tray app that polls the FragtFlow print
queue and prints shipping labels automatically — no manual download/print.

## How it works

1. In FragtFlow, go to **Indstillinger → Printere**, create a print client
   (station), and copy its **token**.
2. Install and launch this app. On first run the settings window opens.
3. Paste the token, pick a printer (or leave blank to use the server default),
   name the station, and **Gem**.
4. The app sits in the system tray and polls the queue every few seconds. When a
   shipment is booked and queued for print, the label prints automatically and
   the job is reported back as `printed` (or `failed`).

## Backend protocol

Talks directly to the deployed Supabase edge function `print-queue`:

- `GET  {apiUrl}?token=<token>` → `{ jobs: [{id, pdf_url, document_type, copies}], printer }`
  (the server atomically marks returned jobs as `printing`; the GET also acts as a heartbeat)
- `POST {apiUrl}?token=<token>` body `{ job_id, status: "printed" | "failed" }`
- `PUT  {apiUrl}?token=<token>` → heartbeat only (used while idle/paused)

The embedded Supabase anon key is a **public** publishable key — it only gets
the request past the API gateway. The per-station `token` is the real auth.

## Develop

```bash
npm install
npm run dev      # build + launch with --dev
```

## Build installers

```bash
npm run dist:win   # NSIS installer  → release/
npm run dist:mac   # DMG             → release/
```

Publishing/auto-update uses GitHub Releases — set `GH_TOKEN` and update the
`publish` block in `electron-builder.config.js`. Add real icons in `assets/`
(see `assets/README.txt`) before distributing.

## Project layout

```
src/main/      Electron main process (tray app, polling, printing)
  config.ts    Build-time defaults (API URL, public anon key)
  store.ts     Persisted settings (electron-store)
  api.ts       print-queue client
  printer.ts   Cross-platform PDF printing (pdf-to-printer / unix-print)
  poller.ts    Polling loop + status
  tray.ts      System-tray menu
  preload.ts   contextBridge IPC for the settings window
  index.ts     App lifecycle, IPC handlers, auto-update
src/renderer/  Settings window (HTML + vanilla JS)
```
