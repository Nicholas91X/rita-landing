'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getUserProfile, updateProfile, updateEmail, updatePassword, getPassportStamps } from '@/app/actions/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { User, Mail, Shield, LogOut, Loader2, Camera, Globe, ChevronLeft, ChevronRight } from 'lucide-react'
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
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500 perspective-[2000px]">
                    <PassportBook userBadges={userData?.badges || []} userProfile={userData?.profile} />
                </div>
            )}
        </div>
    )
}

function PassportBook({ userBadges, userProfile }: { userBadges: any[], userProfile: any }) {
    const [allStamps, setAllStamps] = useState<any[]>([])
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
            <div className={`absolute inset-0 bg-[#fdfbf7] rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_0_100px_rgba(0,0,0,0.05)] border-r-[8px] md:border-r-[12px] border-[#846047]/20 overflow-hidden transition-all duration-500 ${isFlipping ? 'scale-[0.98]' : 'scale-100'}`}>
                {/* Textures and Fold */}
                <div className="absolute inset-0 opacity-[0.4] pointer-events-none mix-blend-multiply"
                    style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }} />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#846047 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                <div className="absolute left-1/2 top-0 bottom-0 w-6 md:w-8 -ml-3 md:-ml-4 bg-gradient-to-r from-black/5 via-black/10 to-black/5 blur-sm z-20 pointer-events-none" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#846047]/20 z-20" />

                <div className={`relative h-full flex flex-row transition-opacity duration-300 ${isFlipping ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'}`}>
                    {/* Left Page (User Bio) */}
                    <div className="w-1/2 p-3 md:p-8 flex flex-col justify-between border-r border-[#846047]/10 relative">
                        <div className="relative z-10 text-center md:text-left">
                            <h2 className="text-[8px] md:text-[10px] font-black text-[#846047] uppercase tracking-[0.2em] mb-1 md:mb-2">Repubblica Italiana del Fitness</h2>
                            <h3 className="text-lg md:text-2xl font-serif font-bold text-[#593e25] leading-none md:leading-tight">
                                Timbri <br />
                                <span className="text-[#846047] italic">Passaporto</span>
                            </h3>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center mt-2 md:mt-4">
                            <div className="relative w-14 h-14 md:w-24 md:h-24 rounded-full border-2 md:border-4 border-[#846047]/10 overflow-hidden mb-2 md:mb-4 bg-white/50 backdrop-blur-sm">
                                {userProfile?.avatar_url ? (
                                    <Image
                                        src={userProfile.avatar_url}
                                        alt={firstName}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-8 h-8 md:w-12 md:h-12 text-[#846047]/30" />
                                    </div>
                                )}
                            </div>
                            <div className="text-center px-1">
                                <p className="text-[7px] md:text-[8px] uppercase tracking-widest font-black text-[#846047]/40 mb-0.5 md:mb-1 leading-none">Titolare</p>
                                <p className="font-serif italic font-bold text-sm md:text-xl text-[#593e25] truncate max-w-full">
                                    {firstName}
                                </p>
                            </div>
                        </div>

                        <div className="text-[7px] md:text-[8px] font-mono text-[#846047]/40 uppercase text-center mt-auto">
                            Pag. {currentPage * 2 + 1}
                        </div>
                    </div>

                    {/* Right Page (Stamps Grid) */}
                    <div className="w-1/2 p-3 md:p-8 relative">
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
                                                <div className="w-full h-full border-2 border-dashed border-[#846047]/10 rounded-full flex items-center justify-center p-1 md:p-2 opacity-20">
                                                    <div className="text-center">
                                                        <span className="block text-[5px] md:text-[8px] font-black uppercase tracking-tight mb-0.5 md:mb-1 truncate px-1">{stampData.name}</span>
                                                        <div className="w-5 h-5 md:w-8 md:h-8 rounded-full bg-[#846047]/20 mx-auto" />
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <div className="w-full h-full border border-dashed border-[#846047]/5 rounded-lg flex items-center justify-center opacity-5">
                                                <span className="text-[7px] md:text-[8px]">---</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="absolute bottom-3 md:bottom-8 right-3 md:right-8 text-[7px] md:text-[8px] font-mono text-[#846047]/40 uppercase">
                            Pag. {currentPage * 2 + 2}
                        </div>
                    </div>
                </div>

                {/* Arrow Controls */}
                <div className="absolute inset-y-0 left-0 flex items-center z-30">
                    <button
                        onClick={() => handlePageChange('prev')}
                        disabled={currentPage === 0 || isFlipping}
                        className="p-1 md:p-2 -ml-2 md:-ml-3 rounded-full bg-white shadow-lg text-[#846047] disabled:hidden hover:scale-110 active:scale-95 transition-all border border-[#846047]/10"
                    >
                        <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center z-30">
                    <button
                        onClick={() => handlePageChange('next')}
                        disabled={currentPage >= safeTotalPages - 1 || isFlipping}
                        className="p-1 md:p-2 -mr-2 md:-mr-3 rounded-full bg-white shadow-lg text-[#846047] disabled:hidden hover:scale-110 active:scale-95 transition-all border border-[#846047]/10"
                    >
                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            {/* Page Count Indicator */}
            <div className="mt-4 md:mt-8 flex justify-center gap-1.5 opacity-40">
                {Array.from({ length: safeTotalPages }).map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === currentPage ? 'w-4 bg-[#846047]' : 'w-1 bg-[#846047]/30'}`} />
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
            case 'bubusettete': return 'text-orange-700 border-orange-700';
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

