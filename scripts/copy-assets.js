// Copies non-TS assets (renderer HTML/JS and tray icons) into dist/ after the
// TypeScript build, preserving the layout the compiled main process expects.
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

// Renderer: copy everything except .ts sources.
const rendererSrc = path.join(root, 'src', 'renderer')
const rendererDest = path.join(root, 'dist', 'renderer')
fs.mkdirSync(rendererDest, { recursive: true })
for (const entry of fs.readdirSync(rendererSrc)) {
  if (entry.endsWith('.ts')) continue
  fs.copyFileSync(path.join(rendererSrc, entry), path.join(rendererDest, entry))
}

// Tray / app icons.
copyDir(path.join(root, 'assets'), path.join(root, 'dist', 'assets'))

console.log('Assets copied to dist/')
