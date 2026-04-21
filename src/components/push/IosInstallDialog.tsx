// src/components/push/IosInstallDialog.tsx
"use client"
import { Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  open: boolean
  onDismiss: () => void
}

export function IosInstallDialog({ open, onDismiss }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss() }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-[2rem] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <Share className="h-5 w-5 text-brand" />
            Installa Rita sulla Home
          </DialogTitle>
          <DialogDescription className="text-neutral-400 font-medium leading-relaxed pt-2">
            Per ricevere notifiche su iPhone devi prima aggiungere l&apos;app
            alla tua schermata Home.
          </DialogDescription>
        </DialogHeader>
        <ol className="text-sm text-neutral-300 space-y-3 pt-2 pl-4 list-decimal">
          <li>Tocca l&apos;icona Condividi <Share className="inline h-4 w-4" /> in basso al browser</li>
          <li>Scegli &quot;Aggiungi alla schermata Home&quot;</li>
          <li>Apri l&apos;app dall&apos;icona installata</li>
        </ol>
        <DialogFooter className="pt-2">
          <Button
            onClick={onDismiss}
            className="w-full bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest rounded-xl"
          >
            Ho capito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
