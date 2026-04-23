'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getUserProfile, updateProfileAction, updateEmail, updatePassword, getPassportStamps } from '@/app/actions/user'
import { requestDataExport, requestAccountDeletionGdpr } from '@/app/actions/gdpr'
import { listMySessions, revokeSession, revokeAllOtherSessions, type SessionInfo } from '@/app/actions/sessions'
import { logger } from '@/lib/logger'
import UserProfileNotifications from './UserProfileNotifications'
import { PushPreferencesSection } from '@/components/push/PushPreferencesSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { User, Mail, Shield, LogOut, Loader2, Camera, ChevronLeft, ChevronRight, Trash2, Sun, Moon, Download, Monitor, X, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import TransitionOverlay from '@/components/TransitionOverlay'
import { useDashTheme } from './ThemeContext'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'

interface Profile {
    id: string
    full_name: string | null
    avatar_url: string | null
    has_used_trial: boolean
}

interface Badge {
    id: string
    badge_type: string
    packages: {
        name: string
    }
}



interface PassportStamp {
    id: string
    name: string
    badge_type: string
}

interface UserProfileData {
    user: {
        email?: string
    }
    profile: Profile
    activeSubscriptions: Array<{
        id: string;
        status: string;
    }>;
    badges: Badge[]
}

interface ProfileSectionProps {
    onProfileUpdate?: () => void | Promise<void>
    activeSubTab?: 'info' | 'badges' | 'notifications'
}

export default function ProfileSection({ onProfileUpdate, activeSubTab = 'info' }: ProfileSectionProps) {
    const [userData, setUserData] = useState<UserProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Dialog states
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletionRequested, setDeletionRequested] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const { theme, toggleTheme } = useDashTheme()

    // Password visibility states
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Form states
    const [formData, setFormData] = useState({
        fullName: '',
        avatar: null as File | null
    })
    const [emailForm, setEmailForm] = useState({ email: '' })
    const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })

    const router = useRouter()
    const supabase = createClient()

    const [fetchError, setFetchError] = useState(false)

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setFetchError(false)
                const data = await getUserProfile()
                setUserData(data)
                setFormData(prev => ({ ...prev, fullName: data.profile?.full_name || '' }))
            } catch (error) {
                logger.error('Failed to fetch profile', error)
                setFetchError(true)
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    const handleLogout = async () => {
        setLoggingOut(true)
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Avatar troppo grande (max 5 MB)')
            e.target.value = ''
            return
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Formato non supportato. Usa JPEG, PNG o WebP.')
            e.target.value = ''
            return
        }
        setFormData(prev => ({ ...prev, avatar: file }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const data = new FormData()
            data.append('full_name', formData.fullName)
            if (formData.avatar) {
                data.append('avatar', formData.avatar)
            }

            const result = await updateProfileAction(data)
            if (!result.ok) {
                toast.error(result.message)
                return
            }

            // Refresh data
            const newData = await getUserProfile()
            setUserData(newData)
            if (onProfileUpdate) onProfileUpdate()
            setIsEditing(false)
            setFormData(prev => ({ ...prev, avatar: null })) // Clear file input
            toast.success('Profilo aggiornato con successo')
        } catch (error) {
            logger.error('Failed to update profile', error)
            toast.error('Errore durante il salvataggio del profilo')
        } finally {
            setSaving(false)
        }
    }

    const handleUpdateEmail = async () => {
        if (!emailForm.email) return
        setSaving(true)
        try {
            await updateEmail(emailForm.email)
            toast.success('Email aggiornata! Controlla la tua casella di posta per confermare.')
            setIsEmailDialogOpen(false)
            setEmailForm({ email: '' })
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento dell\'email'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    const handleUpdatePassword = async () => {
        if (passwordForm.password !== passwordForm.confirmPassword) {
            toast.error('Le password non coincidono')
            return
        }
        if (passwordForm.password.length < 6) {
            toast.error('La password deve essere di almeno 6 caratteri')
            return
        }
        setSaving(true)
        try {
            await updatePassword(passwordForm.password)
            toast.success('Password aggiornata con successo')
            setIsPasswordDialogOpen(false)
            setPasswordForm({ password: '', confirmPassword: '' })
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento della password'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    const [exportPending, setExportPending] = useState(false)
    const [sessions, setSessions] = useState<SessionInfo[]>([])
    const [sessionsLoading, setSessionsLoading] = useState(false)
    const [sessionActionId, setSessionActionId] = useState<string | null>(null)

    const loadSessions = async () => {
        setSessionsLoading(true)
        try {
            const result = await listMySessions()
            if (result.ok) setSessions(result.data)
        } finally {
            setSessionsLoading(false)
        }
    }

    useEffect(() => {
        loadSessions()
    }, [])

    const handleRevokeSession = async (id: string) => {
        setSessionActionId(id)
        try {
            const result = await revokeSession(id)
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            toast.success('Sessione terminata')
            await loadSessions()
        } finally {
            setSessionActionId(null)
        }
    }

    const handleRevokeAllOthers = async () => {
        setSessionActionId('__others__')
        try {
            const result = await revokeAllOtherSessions()
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            toast.success('Altre sessioni terminate')
            await loadSessions()
        } finally {
            setSessionActionId(null)
        }
    }

    const handleExportData = async () => {
        setExportPending(true)
        try {
            const result = await requestDataExport()
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            window.open(result.data.downloadUrl, '_blank')
            toast.success("Esportazione pronta — il download si apre in una nuova scheda.")
        } catch {
            toast.error("Errore durante la generazione dell'esportazione.")
        } finally {
            setExportPending(false)
        }
    }

    const handleDeleteAccount = async () => {
        setSaving(true)
        try {
            const result = await requestAccountDeletionGdpr()
            if (!result.ok) {
                toast.error(result.message)
                return
            }
            setDeletionRequested(true)
            setIsDeleteDialogOpen(false)
            toast.success("Ti abbiamo inviato un'email per completare la cancellazione.")
        } catch {
            toast.error('Errore durante la richiesta. Riprova più tardi.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-[var(--dash-muted-light)]">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Caricamento profilo...</p>
            </div>
        )
    }

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-[var(--dash-muted-light)]">
                <p className="text-lg font-semibold text-red-500">Impossibile caricare il profilo.</p>
                <Button
                    onClick={() => { setLoading(true); setFetchError(false); window.location.reload() }}
                    className="bg-[var(--dash-accent)] text-white hover:bg-[var(--dash-accent)]/90 rounded-xl"
                >
                    Ricarica la pagina
                </Button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl space-y-10 animate-in fade-in duration-500">
            <TransitionOverlay show={loggingOut} message="Uscita in corso..." />
            {activeSubTab === 'info' && (
                <div className="space-y-10 animate-in slide-in-from-left-4 duration-500">
                    {/* ... existing info content ... */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--dash-heading)] tracking-tight">Dati Personali</h2>
                            <p className="text-[var(--dash-muted)] mt-1">Gestisci le tue informazioni dell&apos;account.</p>
                        </div>
                        {!isEditing ? (
                            <Button onClick={() => setIsEditing(true)} className="bg-[var(--dash-accent)] text-white hover:bg-[var(--dash-accent)]/90 rounded-xl">
                                Modifica Profilo
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button onClick={() => setIsEditing(false)} variant="ghost" className="text-[var(--dash-muted-light)] hover:text-white">
                                    Annulla
                                </Button>
                                <Button onClick={handleSave} disabled={saving} className="bg-[var(--dash-accent)] text-white hover:bg-[var(--dash-accent)]/90 rounded-xl min-w-[100px]">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                        <div className="md:col-span-4 space-y-6">
                            <Card className="bg-[var(--dash-card)] border-[var(--dash-accent-border)] shadow-xl overflow-hidden rounded-[32px] p-8 flex flex-col items-center text-center group hover:border-[var(--dash-accent-border)] transition-colors">
                                <div className="relative group cursor-pointer min-w-[44px] min-h-[44px] active:scale-95 transition-transform" onClick={() => isEditing && document.getElementById('avatar-upload')?.click()}>
                                    {userData?.profile?.avatar_url || formData.avatar ? (
                                        <div className="w-32 h-32 rounded-full border-4 border-[var(--dash-accent-border)] overflow-hidden mb-6 shadow-2xl relative">
                                            <Image
                                                src={formData.avatar ? URL.createObjectURL(formData.avatar) : (userData?.profile?.avatar_url || '')}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                                fill
                                                sizes="128px"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-[var(--dash-accent-soft)] border-4 border-[var(--dash-accent-border)] flex items-center justify-center text-4xl font-black text-[var(--dash-accent)] mb-6 transition-all group-hover:scale-105 shadow-sm">
                                            {userData?.user?.email?.substring(0, 2).toUpperCase()}
                                        </div>
                                    )}

                                    {isEditing && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity mb-6">
                                            <Camera className="w-8 h-8 text-white" />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        id="avatar-upload"
                                        className="hidden"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileChange}
                                        disabled={!isEditing}
                                    />
                                </div>

                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                                        placeholder="Nome e Cognome"
                                        className="text-center bg-transparent border-b border-[var(--dash-accent)] text-[var(--dash-text)] font-bold text-xl focus:outline-none w-full pb-1"
                                    />
                                ) : (
                                    <h3 className="text-xl font-bold text-[var(--dash-text)] mb-1">
                                        {userData?.profile?.full_name || 'Utente Ritiana'}
                                    </h3>
                                )}
                                <p className="text-[var(--dash-muted)] text-sm mt-1">{userData?.user?.email}</p>

                                <div className="mt-8 pt-8 border-t border-[var(--dash-border)] w-full">
                                    <Button
                                        onClick={handleLogout}
                                        variant="ghost"
                                        className="w-full text-[#F46530] hover:text-[#F46530]/80 hover:bg-[#F46530]/10 font-bold flex items-center gap-2 transition-all"
                                    >
                                        <LogOut className="w-4 h-4" /> Esci dall&apos;Area Riservata
                                    </Button>
                                </div>
                            </Card>
                        </div>

                        <div className="md:col-span-8 space-y-6">
                            <Card className="bg-[var(--dash-card)] border-[var(--dash-border)] shadow-xl rounded-[32px] overflow-hidden">
                                <CardHeader className="bg-[var(--dash-card-header)] px-8 py-6 border-b border-[var(--dash-border)]">
                                    <CardTitle className="text-[var(--dash-text)] text-lg font-bold">Informazioni Account</CardTitle>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[var(--dash-card-header)] rounded-2xl border border-[var(--dash-border)]">
                                            <Mail className="w-5 h-5 text-[var(--dash-accent)]" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Email Registrazione</label>
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[var(--dash-text)] font-bold">{userData?.user?.email}</p>
                                                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="w-fit text-xs h-8 text-[var(--dash-accent)] hover:bg-[var(--dash-accent-soft)] px-0">
                                                            Modifica Email
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="bg-[var(--dash-card)] border-none rounded-[28px] sm:rounded-[32px] pointer-events-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-[var(--dash-text)] font-black uppercase tracking-tight">Modifica Email</DialogTitle>
                                                            <DialogDescription>
                                                                Inserisci il nuovo indirizzo email. Riceverai una conferma al nuovo indirizzo.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4">
                                                            <Input
                                                                placeholder="Nuova Email"
                                                                value={emailForm.email}
                                                                onChange={(e) => setEmailForm({ email: e.target.value })}
                                                                className="rounded-xl border-[var(--dash-border)]"
                                                            />
                                                        </div>
                                                        <DialogFooter>
                                                            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)}>Annulla</Button>
                                                            <Button onClick={handleUpdateEmail} disabled={saving} className="bg-[var(--dash-accent)] text-white hover:bg-[var(--dash-accent)]/90 rounded-xl">
                                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aggiorna Email'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[var(--dash-card-header)] rounded-2xl border border-[var(--dash-border)]">
                                            <User className="w-5 h-5 text-[var(--dash-accent)]" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Nome Completo</label>
                                            <p className="text-[var(--dash-text)] font-bold">
                                                {userData?.profile?.full_name || <span className="text-[var(--dash-muted-light)] italic">Non impostato</span>}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[var(--dash-card-header)] rounded-2xl border border-[var(--dash-border)]">
                                            <Shield className="w-5 h-5 text-[var(--dash-accent)]" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Sicurezza Pagina</label>
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[var(--dash-text)] font-bold">Password</p>
                                                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="w-fit text-xs h-8 text-[var(--dash-accent)] hover:bg-[var(--dash-accent-soft)] px-0">
                                                            Cambia Password
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="bg-[var(--dash-card)] border-none rounded-[28px] sm:rounded-[32px] pointer-events-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-[var(--dash-text)] font-black uppercase tracking-tight">Cambia Password</DialogTitle>
                                                            <DialogDescription>
                                                                Inserisci la nuova password per il tuo account.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4 space-y-4">
                                                            <div className="relative">
                                                                <Input
                                                                    type={showNewPassword ? "text" : "password"}
                                                                    placeholder="Nuova Password (min. 6 caratteri)"
                                                                    value={passwordForm.password}
                                                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                                                                    className="rounded-xl border-[var(--dash-border)] pr-12"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                                    aria-label={showNewPassword ? "Nascondi password" : "Mostra password"}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dash-muted)] hover:text-[var(--dash-heading)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]/50 rounded-sm"
                                                                >
                                                                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                                </button>
                                                            </div>
                                                            <PasswordStrengthMeter value={passwordForm.password} />
                                                            <div className="relative">
                                                                <Input
                                                                    type={showConfirmPassword ? "text" : "password"}
                                                                    placeholder="Conferma Nuova Password"
                                                                    value={passwordForm.confirmPassword}
                                                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                                    className="rounded-xl border-[var(--dash-border)] pr-12"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                    aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dash-muted)] hover:text-[var(--dash-heading)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]/50 rounded-sm"
                                                                >
                                                                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)}>Annulla</Button>
                                                            <Button onClick={handleUpdatePassword} disabled={saving} className="bg-[var(--dash-accent)] text-white hover:bg-[var(--dash-accent)]/90 rounded-xl">
                                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aggiorna Password'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Theme Toggle */}
                            <Card className="bg-[var(--dash-card)] border-[var(--dash-border)] shadow-xl rounded-[32px] overflow-hidden">
                                <CardContent className="p-6 md:p-8">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-[var(--dash-card-header)] rounded-2xl border border-[var(--dash-border)]">
                                                {theme === 'light' ? (
                                                    <Sun className="w-5 h-5 text-[var(--dash-accent)]" />
                                                ) : (
                                                    <Moon className="w-5 h-5 text-[var(--dash-accent)]" />
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Aspetto</label>
                                                <p className="text-[var(--dash-text)] font-bold">
                                                    {theme === 'light' ? 'Tema Chiaro' : 'Tema Scuro'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={toggleTheme}
                                            className="relative w-14 h-8 rounded-full transition-colors duration-300 focus:outline-none"
                                            style={{ backgroundColor: theme === 'dark' ? 'var(--dash-accent)' : 'var(--dash-border)' }}
                                            aria-label="Cambia tema"
                                        >
                                            <div
                                                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center"
                                                style={{ transform: theme === 'dark' ? 'translateX(24px)' : 'translateX(0)' }}
                                            >
                                                {theme === 'light' ? (
                                                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                                                ) : (
                                                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Active Sessions (Sicurezza) */}
                            <Card className="bg-[var(--dash-card)] border-[var(--dash-border)] shadow-xl rounded-[32px] overflow-hidden">
                                <CardContent className="p-6 md:p-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-[var(--dash-card-header)] rounded-2xl border border-[var(--dash-border)] shrink-0">
                                                <Monitor className="w-5 h-5 text-[var(--dash-accent)]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Sicurezza</label>
                                                <p className="text-[var(--dash-text)] font-bold">Sessioni attive</p>
                                                <p className="text-xs text-[var(--dash-muted-light)] mt-1 leading-relaxed">Dispositivi e browser dove hai effettuato l&apos;accesso.</p>
                                            </div>
                                        </div>

                                        {sessionsLoading ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 className="w-5 h-5 animate-spin text-[var(--dash-muted-light)]" />
                                            </div>
                                        ) : sessions.length === 0 ? (
                                            <p className="text-xs text-[var(--dash-muted-light)] text-center py-4">Nessuna sessione attiva.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {sessions.map((s) => (
                                                    <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card-header)]">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-[var(--dash-text)] truncate">
                                                                {s.user_agent}
                                                                {s.is_current && <span className="ml-2 text-[10px] text-emerald-500 font-bold">· Questa sessione</span>}
                                                            </p>
                                                            <p className="text-[10px] text-[var(--dash-muted-light)] mt-0.5">
                                                                IP: {s.ip} · Ultima attività: {new Date(s.last_active_at).toLocaleString('it-IT')}
                                                            </p>
                                                        </div>
                                                        {!s.is_current && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRevokeSession(s.id)}
                                                                disabled={sessionActionId === s.id}
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                                                                aria-label="Termina sessione"
                                                            >
                                                                {sessionActionId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {sessions.filter((s) => !s.is_current).length > 0 && (
                                            <Button
                                                variant="outline"
                                                onClick={handleRevokeAllOthers}
                                                disabled={sessionActionId === '__others__'}
                                                className="w-full rounded-xl text-sm font-bold py-3 min-h-[44px] border-red-200 text-red-600 hover:bg-red-50"
                                            >
                                                {sessionActionId === '__others__' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Termina tutte le altre sessioni'}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Data Export (GDPR) */}
                            <Card className="bg-[var(--dash-card)] border-[var(--dash-border)] shadow-xl rounded-[32px] overflow-hidden">
                                <CardContent className="p-6 md:p-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-[var(--dash-card-header)] rounded-2xl border border-[var(--dash-border)] shrink-0">
                                                <Download className="w-5 h-5 text-[var(--dash-accent)]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Privacy e Dati</label>
                                                <p className="text-[var(--dash-text)] font-bold">Scarica tutti i miei dati</p>
                                                <p className="text-xs text-[var(--dash-muted-light)] mt-1 leading-relaxed">Esportazione GDPR in formato ZIP contenente profilo, acquisti, fatture, progressi e notifiche.</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={handleExportData}
                                            disabled={exportPending}
                                            className="w-full rounded-xl text-sm font-bold py-3 min-h-[44px] border-[var(--dash-border)] hover:bg-[var(--dash-card-header)]"
                                        >
                                            {exportPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '📦 Scarica i miei dati (ZIP)'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Delete Account */}
                            <Card className="bg-[var(--dash-card)] border-red-100 shadow-xl rounded-[32px] overflow-hidden">
                                <CardContent className="p-6 md:p-8">
                                    <div className="flex flex-col gap-4">
                                        {/* Top: icon + text */}
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-red-50 rounded-2xl border border-red-100 shrink-0">
                                                <Trash2 className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <label className="text-[10px] text-[var(--dash-muted-light)] uppercase font-black tracking-widest block mb-1">Zona Pericolosa</label>
                                                <p className="text-[var(--dash-text)] font-bold">Elimina il mio account</p>
                                                <p className="text-xs text-[var(--dash-muted-light)] mt-1 leading-relaxed">Ti invieremo un&apos;email con un link di conferma valido 15 minuti. Una volta confermato, l&apos;operazione è irreversibile.</p>
                                            </div>
                                        </div>

                                        {/* Bottom: full-width button */}
                                        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    disabled={deletionRequested}
                                                    className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 rounded-xl text-sm font-bold py-3 min-h-[44px]"
                                                >
                                                    {deletionRequested ? '✓ Richiesta inviata' : 'Elimina Account'}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="bg-[var(--dash-card)] border-none rounded-[28px] sm:rounded-[32px] pointer-events-auto">
                                                <DialogHeader>
                                                    <DialogTitle className="text-red-600 font-black uppercase tracking-tight">Invia email di conferma</DialogTitle>
                                                    <DialogDescription>
                                                        Ti invieremo un&apos;email con un link di conferma (valido 15 minuti). Dopo aver cliccato il link, tutti i tuoi dati personali, progressi e abbonamenti attivi verranno eliminati in modo irreversibile. Per obbligo fiscale le fatture saranno conservate 10 anni in forma anonima.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <DialogFooter className="flex-col gap-2 sm:flex-row">
                                                    <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="w-full sm:w-auto">Annulla</Button>
                                                    <Button onClick={handleDeleteAccount} disabled={saving} className="w-full sm:w-auto bg-red-500 text-white hover:bg-red-600 rounded-xl">
                                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invia email di conferma"}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
            {activeSubTab === 'badges' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500 perspective-[2000px]">
                    <PassportBook userBadges={userData?.badges || []} userProfile={userData?.profile || null} />
                </div>
            )}
            {activeSubTab === 'notifications' && (
                <div className="space-y-8">
                    <UserProfileNotifications />
                    <PushPreferencesSection />
                </div>
            )}
        </div >
    )
}

function PassportBook({ userBadges, userProfile }: { userBadges: Badge[], userProfile: Profile | null }) {
    const [allStamps, setAllStamps] = useState<PassportStamp[]>([])
    const [currentPage, setCurrentPage] = useState(0)
    const [isFlipping, setIsFlipping] = useState(false)
    const firstName = userProfile?.full_name?.split(' ')[0] || 'Citizen'

    useEffect(() => {
        const fetchStamps = async () => {
            const stamps = await getPassportStamps()
            setAllStamps(stamps || [])
        }
        fetchStamps()
    }, [])

    const ITEMS_PER_PAGE = 4
    const totalPages = Math.ceil((allStamps.length || 1) / ITEMS_PER_PAGE)
    const safeTotalPages = Math.max(totalPages, 1)

    const handlePageChange = (direction: 'next' | 'prev') => {
        if (isFlipping) return
        if (direction === 'next' && currentPage >= safeTotalPages - 1) return
        if (direction === 'prev' && currentPage <= 0) return

        setIsFlipping(true)

        setTimeout(() => {
            setCurrentPage(prev => direction === 'next' ? prev + 1 : prev - 1)
        }, 300)

        setTimeout(() => {
            setIsFlipping(false)
        }, 600)
    }

    const currentStamps = allStamps.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE)

    return (
        <div className="relative w-full max-w-2xl mx-auto aspect-[1.3/1] md:aspect-[1.4/1]">
            <div className={`absolute inset-0 bg-[#fdfbf7] rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_0_100px_rgba(0,0,0,0.05)] border-r-[8px] md:border-r-[12px] border-[var(--dash-accent-border)] overflow-hidden transition-all duration-500 ${isFlipping ? 'scale-[0.98]' : 'scale-100'}`}>
                <div className="absolute inset-0 opacity-[0.4] pointer-events-none mix-blend-multiply"
                    style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }} />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(var(--dash-accent) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-6 md:w-8 -ml-3 md:-ml-4 bg-gradient-to-r from-black/5 via-black/10 to-black/5 blur-sm z-20 pointer-events-none" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-stone-300 z-20" />

                <div className={`relative h-full flex flex-row transition-opacity duration-300 ${isFlipping ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
                    {/* Left Page (User Bio) */}
                    <div className="w-1/2 p-3 md:p-8 flex flex-col justify-between border-r border-stone-300 relative text-stone-800">
                        <div className="relative z-10 text-center md:text-left">
                            <h2 className="text-[8px] md:text-[10px] font-black text-rose-800 uppercase tracking-[0.2em] mb-1 md:mb-2">Repubblica Italiana del Fitness</h2>
                            <h3 className="text-lg md:text-2xl font-serif font-bold text-stone-900 leading-none md:leading-tight">
                                Timbri <br />
                                <span className="text-rose-800 italic">Passaporto</span>
                            </h3>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center mt-2 md:mt-4">
                            <div className="relative w-14 h-14 md:w-24 md:h-24 rounded-full border-2 md:border-4 border-stone-300 overflow-hidden mb-2 md:mb-4 bg-white/50 backdrop-blur-sm">
                                {userProfile?.avatar_url ? (
                                    <Image
                                        src={userProfile.avatar_url}
                                        alt={firstName}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-8 h-8 md:w-12 md:h-12 text-stone-400" />
                                    </div>
                                )}
                            </div>
                            <div className="text-center px-1">
                                <p className="text-[7px] md:text-[8px] uppercase tracking-widest font-black text-stone-400 mb-0.5 md:mb-1 leading-none">Titolare</p>
                                <p className="font-serif italic font-bold text-sm md:text-xl text-stone-900 truncate max-w-full">
                                    {firstName}
                                </p>
                            </div>
                        </div>

                        <div className="text-[7px] md:text-[8px] font-mono text-stone-400 uppercase text-center mt-auto">
                            Pag. {currentPage * 2 + 1}
                        </div>
                    </div>

                    {/* Right Page (Stamps Grid) */}
                    <div className="w-1/2 p-3 md:p-8 relative text-stone-800">
                        <div className="grid grid-cols-2 gap-2 md:gap-4 h-full content-start">
                            {[0, 1, 2, 3].map((idx) => {
                                const stampData = currentStamps[idx];
                                const hasEarned = userBadges.some(ub => ub.badge_type === stampData?.badge_type);

                                return (
                                    <div key={idx} className="aspect-square relative flex items-center justify-center">
                                        {stampData ? (
                                            hasEarned ? (
                                                <RealStamp
                                                    type={stampData.badge_type}
                                                    name={stampData.badge_type.toUpperCase()}
                                                    date={new Date().toLocaleDateString('it-IT')}
                                                    index={idx}
                                                />
                                            ) : (
                                                <div className="w-full h-full border-2 border-dashed border-stone-800 rounded-full flex items-center justify-center p-1 md:p-2 opacity-20">
                                                    <div className="text-center">
                                                        <span className="block text-[5px] md:text-[8px] font-black uppercase tracking-tight mb-0.5 md:mb-1 truncate px-1 text-stone-800">{stampData.name}</span>
                                                        <div className="w-5 h-5 md:w-8 md:h-8 rounded-full bg-stone-800 mx-auto opacity-50" />
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div className="w-full h-full border border-dashed border-stone-400 rounded-lg flex items-center justify-center opacity-20">
                                                <span className="text-[7px] md:text-[8px] text-stone-500">---</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="absolute bottom-3 md:bottom-8 right-3 md:right-8 text-[7px] md:text-[8px] font-mono text-stone-400 uppercase">
                            Pag. {currentPage * 2 + 2}
                        </div>
                    </div>
                </div>

                {/* Arrow Controls */}
                <div className="absolute inset-y-0 left-0 flex items-center z-30">
                    <button
                        onClick={() => handlePageChange('prev')}
                        disabled={currentPage === 0 || isFlipping}
                        className="p-1 md:p-2 -ml-2 md:-ml-3 rounded-full bg-white shadow-lg text-stone-800 disabled:hidden hover:scale-110 active:scale-95 transition-all border border-stone-300"
                    >
                        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center z-30">
                    <button
                        onClick={() => handlePageChange('next')}
                        disabled={currentPage >= safeTotalPages - 1 || isFlipping}
                        className="p-1 md:p-2 -mr-2 md:-mr-3 rounded-full bg-white shadow-lg text-stone-800 disabled:hidden hover:scale-110 active:scale-95 transition-all border border-stone-300"
                    >
                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            {/* Page Count Indicator */}
            <div className="mt-4 md:mt-8 flex justify-center gap-1.5 opacity-40">
                {Array.from({ length: safeTotalPages }).map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === currentPage ? 'w-4 bg-[var(--dash-accent)]' : 'w-1 bg-[var(--dash-accent)]/30'}`} />
                ))}
            </div>
        </div>
    )
}

function RealStamp({ type, name, date, index }: { type: string, name: string, date: string, index: number }) {
    const rotations = ['rotate-12', '-rotate-6', 'rotate-3', '-rotate-12'];
    const rot = rotations[index % rotations.length];

    const getStampColor = (t: string) => {
        switch (t.toLowerCase()) {
            case 'bali': return 'text-emerald-700 border-emerald-700';
            case 'new_york': return 'text-blue-700 border-blue-700';
            case 'rinascita': return 'text-indigo-700 border-indigo-700';
            case 'lavana': return 'text-orange-600 border-orange-600';
            case 'siviglia': return 'text-rose-700 border-rose-700';
            default: return 'text-neutral-700 border-neutral-700';
        }
    };

    const colorClass = getStampColor(type);

    return (
        <div className={`relative w-20 h-20 md:w-28 md:h-28 ${rot} opacity-90 transition-all hover:scale-110 active:scale-90`}>
            <div className={`absolute inset-0 rounded-full border-[3px] border-double ${colorClass} opacity-80`}
                style={{
                    maskImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.5\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.7\'/%3E%3C/svg%3E")',
                    maskMode: 'luminance',
                    WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.5\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.7\'/%3E%3C/svg%3E")'
                }}
            />
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${colorClass}`}>
                <span className="text-[6px] md:text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 opacity-60">VISA</span>
                <span className="text-xs md:text-sm font-black uppercase tracking-tighter scale-y-125 my-1 border-t border-b border-current/30 py-1 w-[85%] text-center leading-none">
                    {name}
                </span>
                <span className="text-[7px] md:text-[9px] font-mono font-bold tracking-tighter opacity-80">{date}</span>
                <span className="text-[5px] md:text-[7px] font-black uppercase mt-1 tracking-widest opacity-40">Entry Permit</span>
            </div>
            <div className="absolute inset-0 rounded-full mix-blend-multiply opacity-20 pointer-events-none"
                style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stucco.png")' }} />
        </div>
    )
}

