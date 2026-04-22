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
