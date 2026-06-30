/**
 * electron-builder configuration.
 *
 * Produces a one-click NSIS installer on Windows and a DMG on macOS, both
 * publishing to GitHub Releases so electron-updater can auto-update clients.
 * Set GH_TOKEN in the environment (and the `publish` repo below) before running
 * `npm run dist`.
 */
module.exports = {
  appId: 'dk.fragtflow.printclient',
  productName: 'FragtFlow Print',
  copyright: 'FragtFlow',
  directories: {
    output: 'release',
    buildResources: 'assets',
  },
  files: [
    'dist/**/*',
    'package.json',
  ],
  extraMetadata: {
    main: 'dist/main/index.js',
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',
    // Stable, version-less name so the web app can link to
    // /releases/latest/download/FragtFlow-Print-Setup.exe
    artifactName: 'FragtFlow-Print-Setup.exe',
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'FragtFlow Print',
  },
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    icon: 'assets/icon.icns',
    category: 'public.app-category.business',
    artifactName: 'FragtFlow-Print.dmg',
  },
  publish: [
    {
      provider: 'github',
      owner: 'frederikkorff-collab',
      repo: 'fragtflow-print',
    },
  ],
}
