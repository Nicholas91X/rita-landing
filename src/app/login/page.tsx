'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, Lock, User, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { signUpAction, logInAction, recoverPasswordAction, findEmailAction } from '@/app/actions/user'
import {
    signupSchema,
    loginSchema,
    forgotPasswordSchema,
    findEmailSchema,
    type SignupInput,
    type LoginInput,
    type ForgotPasswordInput,
    type FindEmailInput,
} from '@/app/actions/user.schemas'
import TransitionOverlay from '@/components/TransitionOverlay'

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'forgot-email'

export default function LoginPage() {
    const [mode, setMode] = useState<AuthMode>('login')
    const [transitioning, setTransitioning] = useState(false)

    const handleLoginSuccess = () => {
        setTransitioning(true)
        setTimeout(() => {
            window.location.href = '/dashboard'
        }, 600)
    }

    const switchMode = (next: AuthMode) => {
        setMode(next)
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
                    {mode === 'login' && <LoginForm onSuccess={handleLoginSuccess} />}
                    {mode === 'signup' && <SignupForm />}
                    {mode === 'forgot-password' && <ForgotPasswordForm />}
                    {mode === 'forgot-email' && <FindEmailForm />}

                    <div className="mt-6 space-y-4 text-center">
                        {mode === 'login' && (
                            <div className="flex flex-col space-y-2">
                                <button
                                    onClick={() => switchMode('forgot-password')}
                                    className="text-xs text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors"
                                >
                                    Hai dimenticato la password?
                                </button>
                                <button
                                    onClick={() => switchMode('forgot-email')}
                                    className="text-xs text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors"
                                >
                                    Hai dimenticato l&apos;email?
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                if (mode === 'login') switchMode('signup')
                                else switchMode('login')
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

/* ------------------------------------------------------------------ */
/* LoginForm                                                          */
/* ------------------------------------------------------------------ */

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    })
    const [topError, setTopError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    const onSubmit = handleSubmit(async (values) => {
        setTopError(null)
        const fd = new FormData()
        fd.append('email', values.email)
        fd.append('password', values.password)
        try {
            const result = await logInAction(fd)
            if (!result.ok) {
                if (result.fieldErrors) {
                    for (const [field, msgs] of Object.entries(result.fieldErrors)) {
                        if (msgs && msgs.length > 0) {
                            setError(field as keyof LoginInput, { message: msgs[0] })
                        }
                    }
                }
                setTopError(result.message)
                return
            }
            onSuccess()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Si è verificato un errore'
            setTopError(message)
        }
    })

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="space-y-4">
                <div className="relative">
                    <label htmlFor="email" className="sr-only">Email</label>
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="email"
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        {...register('email')}
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    {errors.email && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>
                    )}
                </div>
                <div className="relative">
                    <label htmlFor="password" className="sr-only">Password</label>
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        autoComplete="current-password"
                        {...register('password')}
                        className="w-full pl-10 pr-12 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                        className="absolute right-3 top-3 text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 rounded-sm"
                    >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    {errors.password && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.password.message}</p>
                    )}
                </div>
            </div>

            {topError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                    {topError}
                </div>
            )}

            <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all disabled:opacity-50"
            >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Accedi'}
            </Button>
        </form>
    )
}

/* ------------------------------------------------------------------ */
/* SignupForm                                                         */
/* ------------------------------------------------------------------ */

function SignupForm() {
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<SignupInput>({
        resolver: zodResolver(signupSchema),
    })
    const [topError, setTopError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    const onSubmit = handleSubmit(async (values) => {
        setTopError(null)
        setSuccessMessage(null)
        const fd = new FormData()
        fd.append('email', values.email)
        fd.append('password', values.password)
        fd.append('full_name', values.full_name)
        fd.append('terms_accepted', values.terms_accepted)
        try {
            const result = await signUpAction(fd)
            if (!result.ok) {
                if (result.fieldErrors) {
                    for (const [field, msgs] of Object.entries(result.fieldErrors)) {
                        if (msgs && msgs.length > 0) {
                            setError(field as keyof SignupInput, { message: msgs[0] })
                        }
                    }
                }
                setTopError(result.message)
                return
            }
            if (result.data.needsEmailConfirmation) {
                setSuccessMessage('Controlla la tua email per confermare la registrazione.')
            } else {
                setSuccessMessage('Registrazione completata.')
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Si è verificato un errore'
            setTopError(message)
        }
    })

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="space-y-4">
                <div className="relative">
                    <label htmlFor="fullNameSignup" className="sr-only">Nome e Cognome</label>
                    <User className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="fullNameSignup"
                        type="text"
                        placeholder="Nome e Cognome"
                        autoComplete="name"
                        {...register('full_name')}
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    {errors.full_name && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.full_name.message}</p>
                    )}
                </div>

                <div className="relative">
                    <label htmlFor="emailSignup" className="sr-only">Email</label>
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="emailSignup"
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        {...register('email')}
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    {errors.email && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>
                    )}
                </div>

                <div className="relative">
                    <label htmlFor="passwordSignup" className="sr-only">Password</label>
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="passwordSignup"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        autoComplete="new-password"
                        {...register('password')}
                        className="w-full pl-10 pr-12 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                        className="absolute right-3 top-3 text-[var(--foreground)]/40 hover:text-[var(--brand)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 rounded-sm"
                    >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                    {errors.password && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.password.message}</p>
                    )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        value="on"
                        {...register('terms_accepted')}
                        className="mt-1 h-4 w-4 rounded border-[var(--foreground)]/20 accent-[var(--brand)]"
                    />
                    <span className="text-xs text-[var(--foreground)]/60 leading-relaxed">
                        Ho letto e accetto i{' '}
                        <a href="/terms" target="_blank" className="text-[var(--brand)] underline hover:opacity-80">Termini e Condizioni</a>
                        {' '}e la{' '}
                        <a href="/privacy" target="_blank" className="text-[var(--brand)] underline hover:opacity-80">Privacy Policy</a>.
                    </span>
                </label>
                {errors.terms_accepted && (
                    <p className="text-red-500 text-xs mt-1 ml-1">{errors.terms_accepted.message}</p>
                )}
            </div>

            {topError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                    {topError}
                </div>
            )}

            {successMessage && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center">
                    {successMessage}
                </div>
            )}

            <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all disabled:opacity-50"
            >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Registrati'}
            </Button>
        </form>
    )
}

/* ------------------------------------------------------------------ */
/* ForgotPasswordForm                                                 */
/* ------------------------------------------------------------------ */

function ForgotPasswordForm() {
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordInput>({
        resolver: zodResolver(forgotPasswordSchema),
    })
    const [topError, setTopError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const onSubmit = handleSubmit(async (values) => {
        setTopError(null)
        setSuccessMessage(null)
        const fd = new FormData()
        fd.append('email', values.email)
        try {
            const result = await recoverPasswordAction(fd)
            if (!result.ok) {
                if (result.fieldErrors) {
                    for (const [field, msgs] of Object.entries(result.fieldErrors)) {
                        if (msgs && msgs.length > 0) {
                            setError(field as keyof ForgotPasswordInput, { message: msgs[0] })
                        }
                    }
                }
                setTopError(result.message)
                return
            }
            setSuccessMessage('Email di ripristino inviata. Controlla la tua casella di posta.')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Si è verificato un errore'
            setTopError(message)
        }
    })

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="space-y-4">
                <div className="relative">
                    <label htmlFor="emailForgot" className="sr-only">Email</label>
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="emailForgot"
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        {...register('email')}
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    {errors.email && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>
                    )}
                </div>
            </div>

            {topError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                    {topError}
                </div>
            )}

            {successMessage && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center">
                    {successMessage}
                </div>
            )}

            <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all disabled:opacity-50"
            >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Invia Reset'}
            </Button>
        </form>
    )
}

/* ------------------------------------------------------------------ */
/* FindEmailForm                                                      */
/* ------------------------------------------------------------------ */

function FindEmailForm() {
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FindEmailInput>({
        resolver: zodResolver(findEmailSchema),
    })
    const [topError, setTopError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [maskedEmails, setMaskedEmails] = useState<string[]>([])

    const onSubmit = handleSubmit(async (values) => {
        setTopError(null)
        setSuccessMessage(null)
        setMaskedEmails([])
        const fd = new FormData()
        fd.append('full_name', values.full_name)
        try {
            const result = await findEmailAction(fd)
            if (!result.ok) {
                if (result.fieldErrors) {
                    for (const [field, msgs] of Object.entries(result.fieldErrors)) {
                        if (msgs && msgs.length > 0) {
                            setError(field as keyof FindEmailInput, { message: msgs[0] })
                        }
                    }
                }
                setTopError(result.message)
                return
            }
            setMaskedEmails(result.data.maskedEmails)
            setSuccessMessage('Ecco gli indirizzi email associati al tuo nome:')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Si è verificato un errore'
            setTopError(message)
        }
    })

    return (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="space-y-4">
                <div className="relative">
                    <label htmlFor="fullNameFind" className="sr-only">Nome e Cognome</label>
                    <User className="absolute left-3 top-3 h-5 w-5 text-[var(--foreground)]/40" />
                    <input
                        id="fullNameFind"
                        type="text"
                        placeholder="Nome e Cognome"
                        autoComplete="name"
                        {...register('full_name')}
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--foreground)]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 transition-all"
                    />
                    {errors.full_name && (
                        <p className="text-red-500 text-xs mt-1 ml-1">{errors.full_name.message}</p>
                    )}
                </div>
            </div>

            {topError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                    {topError}
                </div>
            )}

            {successMessage && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center">
                    {successMessage}
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
                disabled={isSubmitting}
                className="w-full py-6 text-lg rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-semibold shadow-lg shadow-[var(--brand)]/20 transition-all disabled:opacity-50"
            >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Cerca Email'}
            </Button>
        </form>
    )
}
