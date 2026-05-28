'use client'

import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Sparkles } from 'lucide-react'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { markCompletionModalShown } from '@/app/actions/lead'

interface LeadCompletionModalProps {
    shouldShow: boolean
    onUpgradeClick: () => void
}

/**
 * One-shot celebration modal shown the first time a lead finishes the 3 free
 * videos. The server action {@link markCompletionModalShown} is idempotent
 * (no-op when `profiles.completion_modal_shown_at` is already set), so even
 * if the page re-mounts before the update commits we won't double-fire.
 */
export default function LeadCompletionModal({
    shouldShow,
    onUpgradeClick,
}: LeadCompletionModalProps) {
    const [open, setOpen] = useState(shouldShow)
    const firedRef = useRef(false)

    useEffect(() => {
        if (!shouldShow || firedRef.current) return
        firedRef.current = true
        setOpen(true)
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } })
        void markCompletionModalShown()
    }, [shouldShow])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md bg-white text-neutral-900">
                <DialogHeader>
                    <div className="mx-auto w-14 h-14 rounded-full bg-[var(--brand)]/15 flex items-center justify-center mb-3">
                        <Sparkles className="h-7 w-7 text-[var(--brand)]" />
                    </div>
                    <DialogTitle className="text-2xl font-bold text-center text-[var(--secondary)]">
                        Hai completato il Rituale della Leggerezza!
                    </DialogTitle>
                    <DialogDescription className="text-center text-neutral-700">
                        Hai guadagnato il primo stamp del passaporto. Sei pronta a continuare il viaggio con noi?
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="border-neutral-300"
                    >
                        Più tardi
                    </Button>
                    <Button
                        onClick={() => {
                            setOpen(false)
                            onUpgradeClick()
                        }}
                        className="bg-[var(--brand)] text-white hover:opacity-90"
                    >
                        Completa la registrazione
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
