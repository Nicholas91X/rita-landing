"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { CreditCard, Info, XCircle } from "lucide-react"

interface CheckoutConfirmationModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    packageName: string
    price?: number
    isLoading?: boolean
}

export function CheckoutConfirmationModal({
    isOpen,
    onOpenChange,
    onConfirm,
    packageName,
    price,
    isLoading
}: CheckoutConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] bg-neutral-900 border-neutral-800 text-white rounded-[32px] overflow-hidden p-0">
                <div className="bg-[var(--brand)] h-2 w-full" />

                <div className="p-8 space-y-6">
                    <DialogHeader className="space-y-3">
                        <div className="w-12 h-12 bg-[var(--brand)]/10 text-[var(--brand)] rounded-2xl flex items-center justify-center mb-2">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">
                            Conferma Abbonamento
                        </DialogTitle>
                        <DialogDescription className="text-neutral-400 text-base leading-relaxed">
                            Stai per sbloccare il pacchetto <span className="text-white font-bold">"{packageName}"</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4">
                            <div className="p-2 h-fit bg-blue-500/10 text-blue-400 rounded-lg">
                                <Info className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-white uppercase tracking-wide">Dettagli Pagamento</p>
                                <p className="text-sm text-neutral-400 leading-relaxed">
                                    L'acquisto sottoscrive un <span className="text-white font-semibold">abbonamento mensile</span> {price ? `da €${price}` : ''}.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4">
                            <div className="p-2 h-fit bg-amber-500/10 text-amber-400 rounded-lg">
                                <XCircle className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-white uppercase tracking-wide">Annullamento</p>
                                <p className="text-sm text-neutral-400 leading-relaxed">
                                    Puoi annullare l'abbonamento in qualsiasi momento dalla sezione <span className="text-white font-semibold italic">Profilo &gt; Billing &gt; Gestisci Abbonamento</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-12 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-xs"
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 h-12 rounded-xl bg-[var(--brand)] text-white hover:bg-white hover:text-[var(--brand)] font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-[var(--brand)]/20"
                        >
                            {isLoading ? "Elaborazione..." : "Conferma e Paga"}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
