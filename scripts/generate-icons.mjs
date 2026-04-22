// scripts/generate-icons.mjs
// Regenerate public/icon-192.png + public/icon-512.png from public/logo/logo.png.
// Fixes: (1) previous files were JPEGs renamed .png, (2) full logo+text was
// unreadable at notification sizes. New icons: square canvas with brand-navy
// background, centered logo with ~10% padding so the circular maskable-any
// crop on Android doesn't clip the graphic.

import sharp from "sharp"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const source = path.join(root, "public/logo/logo.png")
const BRAND_NAVY = { r: 0, g: 31, b: 61, alpha: 1 } // #001F3D

async function makeIcon(size) {
  const padding = Math.round(size * 0.10)
  const innerSize = size - padding * 2

  const resizedLogo = await sharp(source)
    .resize(innerSize, innerSize, { fit: "contain", background: BRAND_NAVY })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_NAVY,
    },
  })
    .composite([{ input: resizedLogo, top: padding, left: padding }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, `public/icon-${size}.png`))

  console.log(`✓ public/icon-${size}.png (${size}×${size})`)
}

await makeIcon(192)
await makeIcon(512)

// Android notification badge: must be monochrome white on transparent.
// Android uses it as the small status-bar icon; if we pass a full-color PNG
// it's discarded and a generic browser silhouette is shown instead.
// We render a bold "R" glyph from an SVG — simple, recognizable at 24dp.
async function makeBadge() {
  const size = 96
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="72"
          font-weight="900" font-style="italic" fill="#ffffff">R</text>
  </svg>`

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public/icon-badge.png"))

  console.log(`✓ public/icon-badge.png (${size}×${size}, monochrome R glyph)`)
}

await makeBadge()
