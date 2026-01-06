'use client'

import { useState, useEffect } from 'react'
import { createPackage, updatePackage, getAdminPackages } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Loader2, Package as PackageIcon } from 'lucide-react'
import { toast } from 'sonner'

type Package = {
    id: string
    name: string
    description: string
    price: number
    stripe_product_id: string | null
    stripe_price_id: string | null
}

export default function AdminPackages() {
    const [packages, setPackages] = useState<Package[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPackage, setEditingPackage] = useState<Package | null>(null)
    const [formData, setFormData] = useState({ name: '', description: '', price: 0 })
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadPackages()
    }, [])

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
                price: pkg.price
            })
        } else {
            setEditingPackage(null)
            setFormData({ name: '', description: '', price: 0 })
        }
        setIsDialogOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSubmitting(true)
        try {
            if (editingPackage) {
                await updatePackage(editingPackage.id, formData)
                toast.success('Pacchetto aggiornato')
            } else {
                await createPackage(formData)
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

    if (loading) return <div className="text-center p-8 text-neutral-400">Caricamento...</div>

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
                    <Card key={pkg.id} className="bg-neutral-900 border-neutral-800 text-neutral-100">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-400">
                                {pkg.stripe_product_id ? 'Sincronizzato Stripe' : 'Non Sincronizzato'}
                            </CardTitle>
                            <PackageIcon className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mb-2">{pkg.name}</div>
                            <p className="text-xs text-neutral-500 mb-4 h-10 overflow-hidden line-clamp-2">
                                {pkg.description}
                            </p>
                            <div className="flex justify-between items-end">
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
                        <DialogTitle>{editingPackage ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}</DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            {editingPackage ? 'Modifica i dettagli e sincronizza con Stripe.' : 'Crea un nuovo pacchetto e il relativo prodotto su Stripe.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-neutral-800 border-neutral-700"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descrizione</label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="bg-neutral-800 border-neutral-700"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Prezzo (€)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                className="bg-neutral-800 border-neutral-700"
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting}>
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {editingPackage ? 'Aggiorna' : 'Crea'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
