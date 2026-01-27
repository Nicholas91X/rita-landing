'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getUserProfile, updateProfile, updateEmail, updatePassword } from '@/app/actions/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { User, Mail, Shield, LogOut, Loader2, Camera, KeyRound, Globe } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
    activeSubTab?: 'info' | 'badges'
}

export default function ProfileSection({ onProfileUpdate, activeSubTab = 'info' }: ProfileSectionProps) {
    const [userData, setUserData] = useState<UserProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Dialog states
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)

    // Form states
    const [formData, setFormData] = useState({
        fullName: '',
        avatar: null as File | null
    })
    const [emailForm, setEmailForm] = useState({ email: '' })
    const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })

    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await getUserProfile()
                setUserData(data)
                setFormData(prev => ({ ...prev, fullName: data.profile?.full_name || '' }))
            } catch (error) {
                console.error('Failed to fetch profile', error)
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, avatar: e.target.files![0] }))
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const data = new FormData()
            data.append('fullName', formData.fullName)
            if (formData.avatar) {
                data.append('avatar', formData.avatar)
            }

            await updateProfile(data)

            // Refresh data
            const newData = await getUserProfile()
            setUserData(newData)
            if (onProfileUpdate) onProfileUpdate()
            setIsEditing(false)
            setFormData(prev => ({ ...prev, avatar: null })) // Clear file input
            toast.success('Profilo aggiornato con successo')
        } catch (error) {
            console.error('Failed to update profile', error)
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Caricamento profilo...</p>
            </div>
        )
    }

    return (
        <div className="max-w-4xl space-y-10 animate-in fade-in duration-500">
            {activeSubTab === 'info' ? (
                <div className="space-y-10 animate-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-[#593e25] tracking-tight">Dati Personali</h2>
                            <p className="text-neutral-500 mt-1">Gestisci le tue informazioni dell&apos;account.</p>
                        </div>
                        {!isEditing ? (
                            <Button onClick={() => setIsEditing(true)} className="bg-[#846047] text-white hover:bg-[#846047]/90 rounded-xl">
                                Modifica Profilo
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button onClick={() => setIsEditing(false)} variant="ghost" className="text-neutral-400 hover:text-white">
                                    Annulla
                                </Button>
                                <Button onClick={handleSave} disabled={saving} className="bg-[#846047] text-white hover:bg-[#846047]/90 rounded-xl min-w-[100px]">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                        <div className="md:col-span-4 space-y-6">
                            <Card className="bg-white border-[#846047]/10 shadow-xl overflow-hidden rounded-[32px] p-8 flex flex-col items-center text-center group hover:border-[#846047]/30 transition-colors">
                                <div className="relative group cursor-pointer" onClick={() => isEditing && document.getElementById('avatar-upload')?.click()}>
                                    {userData?.profile?.avatar_url || formData.avatar ? (
                                        <div className="w-32 h-32 rounded-full border-4 border-[#846047]/10 overflow-hidden mb-6 shadow-2xl relative">
                                            <Image
                                                src={formData.avatar ? URL.createObjectURL(formData.avatar) : (userData?.profile?.avatar_url || '')}
                                                alt="Profile"
                                                className="w-full h-full object-cover"
                                                fill
                                                sizes="128px"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-[#846047]/10 border-4 border-[#846047]/20 flex items-center justify-center text-4xl font-black text-[#846047] mb-6 transition-all group-hover:scale-105 shadow-sm">
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
                                        accept="image/*"
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
                                        className="text-center bg-transparent border-b border-[#846047] text-[#2a2e30] font-bold text-xl focus:outline-none w-full pb-1"
                                    />
                                ) : (
                                    <h3 className="text-xl font-bold text-[#2a2e30] mb-1">
                                        {userData?.profile?.full_name || 'Utente Ritiana'}
                                    </h3>
                                )}
                                <p className="text-neutral-500 text-sm mt-1">{userData?.user?.email}</p>

                                <div className="mt-8 pt-8 border-t border-gray-100 w-full">
                                    <Button
                                        onClick={handleLogout}
                                        variant="ghost"
                                        className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 transition-all"
                                    >
                                        <LogOut className="w-4 h-4" /> Esci dall&apos;Area Riservata
                                    </Button>
                                </div>
                            </Card>
                        </div>

                        <div className="md:col-span-8 space-y-6">
                            <Card className="bg-white border-gray-100 shadow-xl rounded-[32px] overflow-hidden">
                                <CardHeader className="bg-[#f8f9fa] px-8 py-6 border-b border-gray-100">
                                    <CardTitle className="text-[#2a2e30] text-lg font-bold">Informazioni Account</CardTitle>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[#f8f9fa] rounded-2xl border border-gray-100">
                                            <Mail className="w-5 h-5 text-[#846047]" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-neutral-400 uppercase font-black tracking-widest block mb-1">Email Registrazione</label>
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[#2a2e30] font-bold">{userData?.user?.email}</p>
                                                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="w-fit text-xs h-8 text-[#846047] hover:bg-[#846047]/5 px-0">
                                                            Modifica Email
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="bg-white border-none rounded-[32px] pointer-events-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-[#2a2e30] font-black uppercase tracking-tight">Modifica Email</DialogTitle>
                                                            <DialogDescription>
                                                                Inserisci il nuovo indirizzo email. Riceverai una conferma al nuovo indirizzo.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4">
                                                            <Input
                                                                placeholder="Nuova Email"
                                                                value={emailForm.email}
                                                                onChange={(e) => setEmailForm({ email: e.target.value })}
                                                                className="rounded-xl border-gray-200"
                                                            />
                                                        </div>
                                                        <DialogFooter>
                                                            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)}>Annulla</Button>
                                                            <Button onClick={handleUpdateEmail} disabled={saving} className="bg-[#846047] text-white hover:bg-[#846047]/90 rounded-xl">
                                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aggiorna Email'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[#f8f9fa] rounded-2xl border border-gray-100">
                                            <User className="w-5 h-5 text-[#846047]" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-neutral-400 uppercase font-black tracking-widest block mb-1">Nome Completo</label>
                                            <p className="text-[#2a2e30] font-bold">
                                                {userData?.profile?.full_name || <span className="text-gray-300 italic">Non impostato</span>}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[#f8f9fa] rounded-2xl border border-gray-100">
                                            <Shield className="w-5 h-5 text-[#846047]" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-neutral-400 uppercase font-black tracking-widest block mb-1">Sicurezza Pagina</label>
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[#2a2e30] font-bold">Password</p>
                                                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="w-fit text-xs h-8 text-[#846047] hover:bg-[#846047]/5 px-0">
                                                            Cambia Password
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="bg-white border-none rounded-[32px] pointer-events-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-[#2a2e30] font-black uppercase tracking-tight">Cambia Password</DialogTitle>
                                                            <DialogDescription>
                                                                Inserisci la nuova password per il tuo account.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="py-4 space-y-4">
                                                            <Input
                                                                type="password"
                                                                placeholder="Nuova Password (min. 6 caratteri)"
                                                                value={passwordForm.password}
                                                                onChange={(e) => setPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                                                                className="rounded-xl border-gray-200"
                                                            />
                                                            <Input
                                                                type="password"
                                                                placeholder="Conferma Nuova Password"
                                                                value={passwordForm.confirmPassword}
                                                                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                                className="rounded-xl border-gray-200"
                                                            />
                                                        </div>
                                                        <DialogFooter>
                                                            <Button variant="ghost" onClick={() => setIsPasswordDialogOpen(false)}>Annulla</Button>
                                                            <Button onClick={handleUpdatePassword} disabled={saving} className="bg-[#846047] text-white hover:bg-[#846047]/90 rounded-xl">
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
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                    {/* Passport Header Decor */}
                    <div className="bg-[#fdfbf7] border-2 border-[#846047]/20 rounded-[40px] p-8 md:p-12 relative overflow-hidden shadow-2xl">
                        {/* Background Pattern - Subtle guilloche feel */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#846047 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between border-b-2 border-[#846047]/10 pb-10 mb-10">
                            <div className="text-center md:text-left">
                                <h2 className="text-sm font-black text-[#846047] uppercase tracking-[0.2em] mb-2">Documento Ufficiale</h2>
                                <h3 className="text-4xl font-serif font-bold text-[#593e25] tracking-tight">
                                    Il Passaporto di <span className="block md:inline mt-1 md:mt-0 text-[#846047]">{userData?.profile?.full_name?.split(' ')[0] || 'Ritiana'}</span>
                                </h3>
                                <div className="mt-4 flex items-center justify-center md:justify-start gap-3">
                                    <div className="w-10 h-1 bg-[#846047] rounded-full" />
                                    <span className="text-[10px] font-black text-[#846047]/40 uppercase tracking-widest">Documento di Viaggio Fitness</span>
                                </div>
                            </div>
                            <div className="w-24 h-24 rounded-full border-4 border-[#846047]/10 flex items-center justify-center text-5xl bg-white shadow-inner">
                                <Globe className="w-12 h-12 text-[#846047]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 relative max-w-2xl mx-auto">
                            {[0, 1, 2, 3].map((slotIdx) => {
                                const badge = userData?.badges?.[slotIdx];

                                if (badge) {
                                    const rotations = ['rotate-3', '-rotate-2', 'rotate-1', '-rotate-3'];
                                    const rot = rotations[slotIdx % rotations.length];
                                    const colors = [
                                        'border-blue-600/40 text-blue-700/80 bg-blue-50/30',
                                        'border-rose-600/40 text-rose-700/80 bg-rose-50/30',
                                        'border-emerald-600/40 text-emerald-700/80 bg-emerald-50/30',
                                        'border-indigo-600/40 text-indigo-700/80 bg-indigo-50/30'
                                    ];
                                    const color = colors[slotIdx % colors.length];

                                    return (
                                        <div key={badge.id} className={`group relative transition-all duration-500 hover:scale-105 active:scale-95 cursor-default ${rot}`}>
                                            <div className={`aspect-[4/3] p-4 border-[3px] border-dashed rounded-xl flex flex-col items-center justify-center text-center relative overflow-hidden transition-all group-hover:shadow-lg ${color}`}>
                                                <div className="absolute inset-2 border border-current opacity-20 rounded-lg" />
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Entry Permit</span>
                                                <div className="text-4xl md:text-5xl my-2 filter saturate-[0.8] contrast-[1.2]">
                                                    {badge.badge_type === 'leo' && '🦁'}
                                                    {badge.badge_type === 'tiger' && '🐯'}
                                                    {badge.badge_type === 'giraffe' && '🦒'}
                                                    {badge.badge_type === 'elephant' && '🐘'}
                                                    {badge.badge_type === 'monkey' && '🐵'}
                                                    {badge.badge_type === 'wolf' && '🐺'}
                                                    {badge.badge_type === 'fox' && '🦊'}
                                                    {badge.badge_type === 'panda' && '🐼'}
                                                    {!['leo', 'tiger', 'giraffe', 'elephant', 'monkey', 'wolf', 'fox', 'panda'].includes(badge.badge_type) && '🏅'}
                                                </div>
                                                <h4 className="font-serif italic font-bold text-sm md:text-lg leading-none mb-1 uppercase tracking-tight">
                                                    VISTO: {badge.packages?.name?.split(' ')[0] || badge.badge_type}
                                                </h4>
                                                <div className="mt-2 pt-2 border-t border-current/20 w-full flex flex-col gap-0.5">
                                                    <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Verified Member</span>
                                                    <span className="text-[8px] font-mono leading-none">STAMP-{slotIdx + 10}4A</span>
                                                </div>
                                                <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stucco.png")' }} />
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div key={`empty-${slotIdx}`} className="aspect-[4/3] border-2 border-dashed border-[#846047]/20 rounded-xl flex flex-col items-center justify-center p-8 bg-[#846047]/[0.02] group transition-all duration-300 shadow-inner">
                                            <div className="w-16 h-16 rounded-full bg-white/50 border border-dashed border-[#846047]/10 flex items-center justify-center grayscale opacity-10 group-hover:opacity-20 transition-opacity">
                                                <Shield className="w-8 h-8 text-[#846047]" />
                                            </div>
                                            <span className="mt-4 text-[9px] font-black text-[#846047]/20 uppercase tracking-[0.2em]">Spazio Disponibile</span>
                                        </div>
                                    );
                                }
                            })}
                        </div>

                        {/* Pagination footer common in passports */}
                        <div className="mt-16 pt-6 border-t border-[#846047]/10 flex justify-between items-center opacity-40">
                            <span className="text-[8px] font-mono font-bold uppercase">Pagina 04</span>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-[#846047] rounded-full" />
                                <div className="w-1 h-1 bg-[#846047] rounded-full" />
                                <div className="w-1 h-1 bg-[#846047] rounded-full" />
                            </div>
                            <span className="text-[8px] font-mono font-bold uppercase text-right">Ritiana ID: {userData?.profile?.id?.substring(0, 8) || 'GUEST'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
