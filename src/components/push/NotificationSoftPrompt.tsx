// src/components/push/NotificationSoftPrompt.tsx
"use client"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { requestAndSubscribe } from "@/lib/push/client"

interface Props {
  open: boolean
  onDismiss: () => void
  onAccepted: () => void
}

export function NotificationSoftPrompt({ open, onDismiss, onAccepted }: Props) {
  const handleAccept = async () => {
    const r = await requestAndSubscribe()
    if (r.ok) {
      toast.success("Notifiche attivate")
      onAccepted()
      return
    }
    if (r.reason === "permission-denied") {
      toast.info("Puoi riattivarle dalle impostazioni del browser")
    } else if (r.reason === "storage-failed") {
      toast.error("Errore salvando la sottoscrizione, riprova")
    } else {
      toast.error("Notifiche non supportate su questo dispositivo")
    }
    onAccepted()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss() }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-[2rem] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <Bell className="h-5 w-5 text-brand" />
            Vuoi essere avvisata?
          </DialogTitle>
          <DialogDescription className="text-neutral-400 font-medium leading-relaxed pt-2">
            Ricevi una notifica quando Rita carica nuovi allenamenti o risponde
            alle tue richieste. Puoi disattivarle in qualsiasi momento dal tuo
            profilo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-0 pt-2">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="flex-1 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5"
          >
            Più tardi
          </Button>
          <Button
            onClick={handleAccept}
            className="flex-1 bg-brand hover:bg-brand/90 text-white font-black uppercase tracking-widest rounded-xl"
          >
            Sì, attiva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
