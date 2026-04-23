// src/components/video/PlaybackBlockedDialog.tsx
"use client"
import { MonitorSmartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  open: boolean
  byDeviceLabel: string | null
  onTakeover: () => void
  onDismiss: () => void
}

export function PlaybackBlockedDialog({ open, byDeviceLabel, onTakeover, onDismiss }: Props) {
  const deviceText = byDeviceLabel ?? "un altro dispositivo"
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss() }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-[2rem] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <MonitorSmartphone className="h-5 w-5 text-brand" />
            Contenuto in riproduzione altrove
          </DialogTitle>
          <DialogDescription className="text-neutral-400 font-medium leading-relaxed pt-2">
            Questo contenuto è attualmente in riproduzione su <strong className="text-white">{deviceText}</strong>.
            Puoi continuare qui, ma l&apos;altro dispositivo verrà messo in pausa.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-0 pt-2">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="flex-1 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
          >
            Annulla
          </Button>
          <Button
            onClick={onTakeover}
            className="flex-1 bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest rounded-xl"
          >
            Continua qui
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
