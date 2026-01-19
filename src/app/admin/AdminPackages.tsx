'use client'

import { useState, useEffect } from 'react'
import { createPackage, updatePackage, getAdminPackages, getAdminCourses } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Loader2, Package as PackageIcon } from 'lucide-react'
import { toast } from 'sonner'

type Package = {
    id: string
    name: string
    description: string
    price: number
    stripe_product_id: string | null
    stripe_price_id: string | null
    course_id: string | null
    badge_type: string | null
    image_url: string | null
    courses?: { name: string }
}

type Course = {
    id: string
    name: string
    levels: { name: string }[] | { name: string } | null
}

export default function AdminPackages() {
    const [packages, setPackages] = useState<Package[]>([])
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPackage, setEditingPackage] = useState<Package | null>(null)
    const [formData, setFormData] = useState({ name: '', description: '', price: 0, course_id: '', badge_type: '' })
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        Promise.all([loadPackages(), loadCourses()])
    }, [])

    async function loadCourses() {
        try {
            const data = await getAdminCourses()
            setCourses(data as Course[])
        } catch {
            toast.error('Errore nel caricamento dei corsi')
        }
    }

    async function loadPackages() {
        try {
            const data = await getAdminPackages()
            setPackages(data as Package[])
        } catch {
            toast.error('Errore nel caricamento dei pacchetti')
        } finally {
            setLoading(false)
        }
    }

    function handleOpenDialog(pkg?: Package) {
        if (pkg) {
            setEditingPackage(pkg)
            setFormData({
                name: pkg.name,
                description: pkg.description || '',
                price: pkg.price,
                course_id: pkg.course_id || '',
                badge_type: pkg.badge_type || ''
            })
            setImagePreview(pkg.image_url)
        } else {
            setEditingPackage(null)
            setFormData({ name: '', description: '', price: 0, course_id: '', badge_type: '' })
            setImagePreview(null)
        }
        setImageFile(null)
        setIsDialogOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)

        const data = new FormData()
        data.append('name', formData.name)
        data.append('description', formData.description)
        data.append('price', formData.price.toString())
        data.append('course_id', formData.course_id)
        data.append('badge_type', formData.badge_type)
        if (imageFile) {
            data.append('image', imageFile)
        }
        if (!imagePreview && editingPackage?.image_url) {
            data.append('removeImage', 'true')
        }

        try {
            if (editingPackage) {
                await updatePackage(editingPackage.id, data)
                toast.success('Pacchetto aggiornato')
            } else {
                await createPackage(data)
                toast.success('Pacchetto creato')
            }
            setIsDialogOpen(false)
            loadPackages()
        } catch (error: unknown) {
            toast.error((error as Error).message || 'Errore nel salvataggio')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="text-center p-8 text-white font-bold italic animate-pulse">Caricamento...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">
                    Gestione Pacchetti
                </h2>
                <Button onClick={() => handleOpenDialog()} className="bg-white text-black hover:bg-neutral-200">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuovo Pacchetto
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => (
                    <Card key={pkg.id} className="bg-neutral-900 border-neutral-800 text-neutral-100 overflow-hidden flex flex-col">
                        <div className="h-32 w-full bg-neutral-800 relative overflow-hidden flex items-center justify-center">
                            {pkg.image_url ? (
                                <Image
                                    src={pkg.image_url}
                                    alt={pkg.name}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                            ) : (
                                <div className="text-neutral-600">
                                    <PackageIcon className="w-12 h-12" />
                                </div>
                            )}
                            <div className="absolute top-2 right-2">
                                <span className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                    pkg.stripe_product_id ? "bg-emerald-500/20 text-emerald-500" : "bg-neutral-500/20 text-neutral-200"
                                )}>
                                    {pkg.stripe_product_id ? 'Sincronizzato' : 'Off-line'}
                                </span>
                            </div>
                        </div>
                        <CardContent className="pt-6 flex-1 flex flex-col">
                            <div className="text-2xl font-bold mb-1">{pkg.name}</div>
                            <div className="text-xs font-black text-brand uppercase tracking-widest mb-3">
                                {pkg.courses?.name || 'Nessun Corso'}
                            </div>
                            <p className="text-xs text-neutral-200 font-medium mb-4 h-10 overflow-hidden line-clamp-2 leading-relaxed">
                                {pkg.description}
                            </p>
                            <div className="mt-auto flex justify-between items-end">
                                <span className="text-xl font-semibold">€ {pkg.price}</span>
                                <Button size="sm" variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={() => handleOpenDialog(pkg)}>
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-white font-black uppercase italic tracking-tight">
                            {editingPackage ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}
                        </DialogTitle>
                        <DialogDescription className="text-neutral-200 font-medium">
                            {editingPackage ? 'Modifica i dettagli e sincronizza con Stripe.' : 'Crea un nuovo pacchetto e il relativo prodotto su Stripe.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-4">
                            {/* Image Upload Area */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Immagine Cover</label>
                                <div
                                    className="h-40 w-full bg-neutral-800 rounded-xl border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-brand/40 transition-colors"
                                    onClick={() => document.getElementById('image-upload')?.click()}
                                >
                                    {imagePreview ? (
                                        <>
                                            <Image
                                                src={imagePreview}
                                                alt="Anteprima immagine"
                                                fill
                                                className="object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-white hover:text-red-400"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setImagePreview(null)
                                                        setImageFile(null)
                                                    }}
                                                >
                                                    Rimuovi
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4">
                                            <Plus className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                                            <p className="text-xs text-white font-bold uppercase tracking-widest">Carica Immagine</p>
                                        </div>
                                    )}
                                    <input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                setImageFile(file)
                                                const url = URL.createObjectURL(file)
                                                setImagePreview(url)
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Nome</label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="bg-neutral-800 border-neutral-700"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Descrizione</label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="bg-neutral-800 border-neutral-700"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Prezzo (€)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                        className="bg-neutral-800 border-neutral-700"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Corso</label>
                                    <select
                                        value={formData.course_id}
                                        onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                        className="w-full h-10 bg-neutral-800 border-neutral-700 rounded-md px-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                    >
                                        <option value="" disabled>Seleziona...</option>
                                        {courses.map(course => (
                                            <option key={course.id} value={course.id}>
                                                {course.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-bold text-white uppercase tracking-widest text-[10px]">Badge di Completamento</label>
                                    <select
                                        value={formData.badge_type}
                                        onChange={(e) => setFormData({ ...formData, badge_type: e.target.value })}
                                        className="w-full h-10 bg-neutral-800 border-neutral-700 rounded-md px-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        required
                                    >
                                        <option value="" disabled>Seleziona un badge...</option>
                                        <option value="leo">🦁 Leone (Energia/Forza)</option>
                                        <option value="tiger">🐯 Tigre (Coraggio/Poderosa)</option>
                                        <option value="giraffe">🦒 Giraffa (Sguardo Alto/Prospettiva)</option>
                                        <option value="elephant">🐘 Elefante (Saggezza/Stabilità)</option>
                                        <option value="monkey">🐒 Scimmia (Gioia/Flessibilità)</option>
                                        <option value="wolf">🐺 Lupo (Determinazione/Leadership)</option>
                                        <option value="fox">🦊 Volpe (Intelligenza/Adattabilità)</option>
                                        <option value="panda">🐼 Panda (Equilibrio/Gentilezza)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]" disabled={submitting}>
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingPackage ? 'Aggiorna' : 'Crea')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
