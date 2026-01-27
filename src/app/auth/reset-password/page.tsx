'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { updatePassword } from '@/app/actions/user'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError('Le password non coincidono')
            return
        }

        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            await updatePassword(password)
            setMessage('Password aggiornata con successo. Verrai reindirizzato al login.')
            setTimeout(() => {
                router.push('/login')
            }, 3000)
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Si è verificato un errore'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="flex flex-col items-center text-center">
                    <div className="mb-6">
                        <Logo variant="circle" height={80} showText={false} />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
                        Nuova Password
                    </h2>
                    <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
                        Nuova Password
                    </h2>
                    <p className="mt-2 text-sm text-[var(--foreground)]/60">
                        Inserisci la tua nuova password per accedere al tuo account
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-[var(--panel)] p-8 rounded-2xl border border-[var(--brand)]/10 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Nuova Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-12 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Conferma Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-12 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-3 text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center">
                                {message}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !!message}
                            className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                'Aggiorna Password'
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => router.push('/login')}
                            className="text-sm text-[var(--foreground)]/60 hover:text-[var(--brand)] transition-colors inline-flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Torna al login
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
