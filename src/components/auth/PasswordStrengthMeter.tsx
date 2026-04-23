// src/components/auth/PasswordStrengthMeter.tsx
"use client"
import { useEffect, useState } from "react"
import { computeStrength, type Strength } from "@/lib/password-strength"

interface Props {
  value: string
}

const BAR_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-red-500",
  1: "bg-orange-500",
  2: "bg-yellow-500",
  3: "bg-emerald-500",
  4: "bg-teal-400",
}

const LABEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "text-red-500",
  1: "text-orange-500",
  2: "text-yellow-600",
  3: "text-emerald-600",
  4: "text-teal-500",
}

export function PasswordStrengthMeter({ value }: Props) {
  const [strength, setStrength] = useState<Strength>({ score: 0, label: "" })

  useEffect(() => {
    let cancelled = false
    computeStrength(value)
      .then((s) => {
        if (!cancelled) setStrength(s)
      })
      .catch(() => {
        // zxcvbn lib failed to load → fail-soft, renders neutral state.
      })
    return () => {
      cancelled = true
    }
  }, [value])

  const activeBars = value ? strength.score + 1 : 0
  const color = value ? BAR_COLORS[strength.score] : ""

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            data-bar
            className={`h-1 flex-1 rounded-full ${i < activeBars ? color : "bg-neutral-200"}`}
          />
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs font-bold mt-1 ${LABEL_COLORS[strength.score]}`}>
          {strength.label}
        </p>
      )}
    </div>
  )
}
