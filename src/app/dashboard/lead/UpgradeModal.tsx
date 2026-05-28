'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Loader2, Eye, EyeOff } from 'lucide-react'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { upgradeLeadToStandard } from '@/app/actions/lead'
import { upgradeLeadSchema, type UpgradeLeadInput } from '@/app/actions/lead.schemas'

interface UpgradeModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [showPwd, setShowPwd] = useState(false)
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<UpgradeLeadInput>({
        resolver: zodResolver(upgradeLeadSchema),
        mode: 'onSubmit',
    })
    const passwordValue = watch('password', '')

    const onSubmit = handleSubmit(async (values) => {
        setError(null)
        const fd = new FormData()
        fd.append('password', values.password)
        const res = await upgradeLeadToStandard(fd)
        if (!res.ok) {
            setError(res.message)
            return
        }
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
        toast.success('Registrazione completata. Bentornata nel percorso completo!')
        onOpenChange(false)
        router.refresh()
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white text-neutral-900">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-[var(--secondary)]">
                        Completa la registrazione
                    </DialogTitle>
                    <DialogDescription className="text-neutral-600">
                        Ti basta scegliere una password. Mantieni email, profilo, badge e i 3 video del Rituale della Leggerezza.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="upgrade-password"
                            className="block text-sm font-semibold mb-1 text-neutral-700"
                        >
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="upgrade-password"
                                type={showPwd ? 'text' : 'password'}
                                autoComplete="new-password"
                                {...register('password')}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-md pr-10 focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPwd((v) => !v)}
                                aria-label={showPwd ? 'Nascondi password' : 'Mostra password'}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                            >
                                {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                        <PasswordStrengthMeter value={passwordValue} />
                        {errors.password && (
                            <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[var(--brand)] hover:opacity-90 text-white font-bold py-3 rounded-xl"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            'Completa →'
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
