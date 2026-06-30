App + tray icons go here:

  icon.ico          Windows app icon (256x256, multi-size .ico)
  icon.icns         macOS app icon
  tray.ico          Windows tray icon (16x16 / 32x32)
  trayTemplate.png  macOS tray icon (16x16, black + alpha "Template" image)

These are referenced by electron-builder.config.js (icon.ico / icon.icns) and
src/main/tray.ts (tray.ico / trayTemplate.png). The app falls back to an empty
tray image if the tray icon is missing, so it still runs without them — but ship
real icons before distributing.
