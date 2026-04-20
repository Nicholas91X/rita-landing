'use client'

import { useState } from 'react'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Lock, User, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { recoverPassword, findEmail, signUpAction, logInAction } from '@/app/actions/user'
import TransitionOverlay from '@/components/TransitionOverlay'

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'forgot-email'

export default function LoginPage() {
    const [mode, setMode] = useState<AuthMode>('login')
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [fullName, setFullName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [maskedEmails, setMaskedEmails] = useState<string[]>([])
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [transitioning, setTransitioning] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)
        setMaskedEmails([])

        try {
            if (mode === 'login') {
                const fd = new FormData()
                fd.append('email', email)
                fd.append('password', password)

                const result = await logInAction(fd)
                if (!result.ok) {
                    setError(result.message)
                    setLoading(false)
                    return
                }

                setTransitioning(true)
                setTimeout(() => { window.location.href = '/dashboard' }, 600)
                return
            } else if (mode === 'signup') {
                const fd = new FormData()
                fd.append('email', email)
                fd.append('password', password)
                fd.append('full_name', fullName)
                if (acceptedTerms) fd.append('terms_accepted', 'on')

                const result = await signUpAction(fd)
                if (!result.ok) {
                    setError(result.message)
                    setLoading(false)
                    return
                }
                if (result.data.needsEmailConfirmation) {
                    setMessage('Controlla la tua email per confermare la registrazione.')
                }
            } else if (mode === 'forgot-password') {
                await recoverPassword(email)
                setMessage('Email di ripristino inviata. Controlla la tua casella di posta.')
            } else if (mode === 'forgot-email') {
                const result = await findEmail(fullName)
                setMaskedEmails(result.maskedEmails)
                setMessage('Ecco gli indirizzi email associati al tuo nome:')
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
            <TransitionOverlay show={transitioning} message="Accesso in corso..." />
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="flex flex-col items-center text-center">
                    <div className="mb-6">
                        <Logo variant="circle" height={80} showText={false} />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
                        {mode === 'login' && 'Bentornata'}
                        {mode === 'signup' && 'Crea un account'}
                        {mode === 'forgot-password' && 'Recupera Password'}
                        {mode === 'forgot-email' && 'Recupera Email'}
                    </h2>
                    <p className="mt-2 text-sm text-[var(--foreground)]/60">
                        {mode === 'login' && 'Inserisci le tue credenziali per accedere'}
                        {mode === 'signup' && 'Inizia il tuo percorso di allenamento'}
                        {mode === 'forgot-password' && 'Inserisci la tua email per ricevere il link di ripristino'}
                        {mode === 'forgot-email' && 'Inserisci il tuo nome completo per trovare la tua email'}
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-[var(--panel)] p-8 rounded-2xl border border-[var(--brand)]/10 shadow-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            {mode === 'forgot-email' ? (
                                <div className="relative">
                                    <label htmlFor="fullName" className="sr-only">Nome e Cognome</label>
                                    <User className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                    <input
                                        id="fullName"
                                        type="text"
                                        placeholder="Nome e Cognome"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                    />
                                </div>
                            ) : (
                                <>
                                    {mode === 'signup' && (
                                        <div className="relative">
                                            <label htmlFor="fullNameSignup" className="sr-only">Nome e Cognome</label>
                                            <User className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                            <input
                                                id="fullNameSignup"
                                                type="text"
                                                placeholder="Nome e Cognome"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                required
                                                minLength={2}
                                                className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                            />
                                        </div>
                                    )}
                                    <div className="relative">
                                        <label htmlFor="email" className="sr-only">Email</label>
                                        <Mail className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                        <input
                                            id="email"
                                            type="email"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                        />
                                    </div>
                                </>
                            )}

                            {(mode === 'login' || mode === 'signup') && (
                                <div className="relative">
                                    <label htmlFor="password" className="sr-only">Password</label>
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full pl-10 pr-12 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                                        className="absolute right-3 top-3 text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 rounded-sm"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            )}

                            {mode === 'signup' && (
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={acceptedTerms}
                                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-[var(--foreground)]/20 accent-[var(--brand)]"
                                    />
                                    <span className="text-xs text-[var(--foreground)]/60 leading-relaxed">
                                        Ho letto e accetto i{' '}
                                        <a href="/terms" target="_blank" className="text-[var(--brand)] underline hover:opacity-80">Termini e Condizioni</a>
                                        {' '}e la{' '}
                                        <a href="/privacy" target="_blank" className="text-[var(--brand)] underline hover:opacity-80">Privacy Policy</a>.
                                    </span>
                                </label>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center">
                                {message}
                                {maskedEmails.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {maskedEmails.map((email, idx) => (
                                            <div key={idx} className="font-mono font-bold">{email}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || (mode === 'signup' && !acceptedTerms)}
                            className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' && 'Accedi'}
                                    {mode === 'signup' && 'Registrati'}
                                    {mode === 'forgot-password' && 'Invia Reset'}
                                    {mode === 'forgot-email' && 'Cerca Email'}
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 space-y-4 text-center">
                        {mode === 'login' && (
                            <div className="flex flex-col space-y-2">
                                <button
                                    onClick={() => setMode('forgot-password')}
                                    className="text-xs text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors"
                                >
                                    Hai dimenticato la password?
                                </button>
                                <button
                                    onClick={() => setMode('forgot-email')}
                                    className="text-xs text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors"
                                >
                                    Hai dimenticato l&apos;email?
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                if (mode === 'login') setMode('signup');
                                else setMode('login');
                                setError(null);
                                setMessage(null);
                            }}
                            className="text-sm text-[var(--foreground)]/60 hover:text-[var(--brand)] transition-colors inline-flex items-center gap-2"
                        >
                            {mode !== 'login' && mode !== 'signup' && <ArrowLeft className="h-4 w-4" />}
                            {mode === 'login' && 'Non hai un account? Registrati'}
                            {mode === 'signup' && 'Hai già un account? Accedi'}
                            {mode !== 'login' && mode !== 'signup' && 'Torna al login'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
