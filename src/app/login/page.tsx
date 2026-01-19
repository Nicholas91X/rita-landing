'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const supabase = createClient()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                router.push('/dashboard')
                router.refresh()
            } else {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                })
                if (error) throw error

                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    setError('Utente già registrato. Prova ad accedere.')
                } else {
                    setMessage('Controlla la tua email per confermare la registrazione.')
                }
            }
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
                        {isLogin ? 'Bentornata' : 'Crea un account'}
                    </h2>
                    <p className="mt-2 text-sm text-[var(--foreground)]/60">
                        {isLogin
                            ? 'Inserisci le tue credenziali per accedere'
                            : 'Inizia il tuo percorso di allenamento'}
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-[var(--panel)] p-8 rounded-2xl border border-[var(--brand)]/10 shadow-xl">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                />
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
                            disabled={loading}
                            className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                isLogin ? 'Accedi' : 'Registrati'
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm text-[var(--foreground)]/60 hover:text-[var(--brand)] transition-colors"
                        >
                            {isLogin
                                ? 'Non hai un account? Registrati'
                                : 'Hai già un account? Accedi'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
