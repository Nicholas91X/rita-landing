// src/lib/password-strength.ts
// Thin wrapper around @zxcvbn-ts/core. Lazy-loads language packs once.
// The meter is advisory only — submit validation is handled separately by
// `passwordSchema` in @/lib/security/validation.ts + Sub-1's HIBP check.

import { zxcvbnOptions, zxcvbnAsync } from "@zxcvbn-ts/core"

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
}

const LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "Molto debole",
  1: "Debole",
  2: "Media",
  3: "Forte",
  4: "Ottima",
}

let configured: Promise<void> | null = null
function ensureConfigured(): Promise<void> {
  if (!configured) {
    configured = (async () => {
      const common = await import("@zxcvbn-ts/language-common")
      const en = await import("@zxcvbn-ts/language-en")
      zxcvbnOptions.setOptions({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      })
    })()
  }
  return configured
}

export async function computeStrength(value: string): Promise<Strength> {
  if (!value) return { score: 0, label: "" }
  await ensureConfigured()
  // zxcvbn handles strings up to ~256 chars efficiently; we cap at 72 to
  // match bcrypt limit used by passwordSchema.
  const input = value.length > 72 ? value.slice(0, 72) : value
  const result = await zxcvbnAsync(input)
  const score = result.score as 0 | 1 | 2 | 3 | 4
  return { score, label: LABELS[score] }
}
