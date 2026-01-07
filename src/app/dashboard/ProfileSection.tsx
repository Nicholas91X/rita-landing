'use client'

import { useState, useEffect } from 'react'
import { getUserProfile, updateProfile } from '@/app/actions/user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Mail, Shield, LogOut, Loader2, Camera } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfileSection({ onProfileUpdate }: { onProfileUpdate?: () => void }) {
    const [userData, setUserData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        fullName: '',
        avatar: null as File | null
    })
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
        } catch (error) {
            console.error('Failed to update profile', error)
            alert('Errore durante il salvataggio del profilo')
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
        <div className="max-w-4xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Il tuo Profilo</h2>
                    <p className="text-neutral-400 mt-1">Gestisci le tue informazioni personali.</p>
                </div>
                {!isEditing ? (
                    <Button onClick={() => setIsEditing(true)} className="bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 rounded-xl">
                        Modifica Profilo
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button onClick={() => setIsEditing(false)} variant="ghost" className="text-neutral-400 hover:text-white">
                            Annulla
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 rounded-xl min-w-[100px]">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                <div className="md:col-span-4 space-y-6">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-2xl overflow-hidden rounded-[32px] p-8 flex flex-col items-center text-center group hover:border-[var(--brand)]/30 transition-colors">
                        <div className="relative group cursor-pointer" onClick={() => isEditing && document.getElementById('avatar-upload')?.click()}>
                            {userData?.profile?.avatar_url || formData.avatar ? (
                                <div className="w-32 h-32 rounded-full border-4 border-[var(--brand)]/20 overflow-hidden mb-6 shadow-2xl">
                                    <img
                                        src={formData.avatar ? URL.createObjectURL(formData.avatar) : userData?.profile?.avatar_url}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-[var(--brand)]/10 border-4 border-[var(--brand)]/20 flex items-center justify-center text-4xl font-black text-[var(--brand)] mb-6 transition-all group-hover:scale-105 shadow-[0_0_30px_rgba(244,101,48,0.2)]">
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
                                className="text-center bg-transparent border-b border-[var(--brand)] text-white font-bold text-xl focus:outline-none w-full pb-1"
                            />
                        ) : (
                            <h3 className="text-xl font-bold text-white mb-1">
                                {userData?.profile?.full_name || 'Utente Ritiana'}
                            </h3>
                        )}
                        <p className="text-neutral-500 text-sm mt-1">{userData?.user?.email}</p>

                        <div className="mt-8 pt-8 border-t border-white/5 w-full">
                            <Button
                                onClick={handleLogout}
                                variant="destructive"
                                className="w-full h-12 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 transition-all font-bold flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" /> Esci dall'Area Riservata
                            </Button>
                        </div>
                    </Card>
                </div>

                <div className="md:col-span-8 space-y-6">
                    <Card className="bg-white/5 backdrop-blur-md border-white/5 shadow-2xl rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-white/5 px-8 py-6">
                            <CardTitle className="text-white text-lg font-bold">Informazioni Account</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/5 rounded-2xl">
                                    <Mail className="w-5 h-5 text-[var(--brand)]" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest block mb-1">Email Registrazione</label>
                                    <p className="text-white font-medium">{userData?.user?.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/5 rounded-2xl">
                                    <User className="w-5 h-5 text-[var(--brand)]" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest block mb-1">Nome Completo</label>
                                    <p className="text-white font-medium">
                                        {userData?.profile?.full_name || <span className="text-white/20 italic">Non impostato</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/5 rounded-2xl">
                                    <Shield className="w-5 h-5 text-[var(--brand)]" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest block mb-1">ID Utente</label>
                                    <p className="text-neutral-500 font-mono text-xs">{userData?.user?.id}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-6 border border-amber-500/20 bg-amber-500/5 rounded-[24px]">
                        <p className="text-amber-500/80 text-xs italic">
                            Le impostazioni di sicurezza (password e 2FA) possono essere gestite tramite il link di reset inviato alla tua email in fase di registrazione.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
