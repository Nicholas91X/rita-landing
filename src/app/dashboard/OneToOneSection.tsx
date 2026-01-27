'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Check, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { createCheckoutSession } from '@/app/actions/stripe'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type OneTimePackage = {
    id: string
    name: string
    title: string | null
    description: string
    price: number
    image_url: string | null
    isPurchased: boolean
    status?: string
}

export default function OneToOneSection() {
    const [packages, setPackages] = useState<OneTimePackage[]>([])
    const [loading, setLoading] = useState(true)
    const [purchasingId, setPurchasingId] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        async function fetchPackages() {
            try {
                const supabase = createClient()

                // 1. Get all 'payment' mode packages
                const { data: pkgs, error } = await supabase
                    .from('packages')
                    .select('*')
                    .eq('payment_mode', 'payment')

                if (error) throw error

                // 2. Check which ones are purchased
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: purchases } = await supabase
                    .from('one_time_purchases')
                    .select('package_id, status')
                    .eq('user_id', user.id)

                const { data: subs } = await supabase
                    .from('user_subscriptions')
                    .select('package_id, status')
                    .eq('user_id', user.id)

                // Map of package_id -> status
                const purchaseStatusMap = new Map<string, string>();
                purchases?.forEach(p => purchaseStatusMap.set(p.package_id, p.status || 'purchased'));
                subs?.forEach(s => purchaseStatusMap.set(s.package_id, s.status));

                const mappedPackages = (pkgs || []).map(p => ({
                    ...p,
                    isPurchased: purchaseStatusMap.has(p.id),
                    status: purchaseStatusMap.get(p.id)
                }))

                setPackages(mappedPackages)
            } catch (error) {
                console.error('Error fetching generic packages:', error)
                toast.error('Impossibile caricare i pacchetti')
            } finally {
                setLoading(false)
            }
        }

        fetchPackages()
    }, [])

    const handlePurchase = async (pkgId: string) => {
        try {
            setPurchasingId(pkgId)
            const url = await createCheckoutSession(pkgId)
            if (url) {
                router.push(url)
            }
        } catch (error) {
            console.error('Purchase error:', error)
            toast.error('Errore durante l\'inizializzazione dell\'acquisto')
        } finally {
            setPurchasingId(null)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="w-10 h-10 animate-spin text-brand mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">Caricamento...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-bold text-[#593e25] tracking-tight uppercase flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-brand" />
                    Percorsi 1:1
                </h2>
                <p className="text-[#2a2e30] opacity-80 max-w-2xl">
                    Esperienze esclusive e percorsi personalizzati one-to-one.
                </p>
            </div>

            {packages.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-neutral-300">
                    <p className="text-neutral-500 font-medium">Nessun percorso 1:1 disponibile al momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {packages.map((pkg) => (
                        <Card key={pkg.id} className="overflow-hidden border-none shadow-xl bg-white rounded-3xl flex flex-col h-full hover:shadow-2xl transition-all duration-300 group">
                            <div className="relative h-56 w-full overflow-hidden">
                                {pkg.image_url ? (
                                    <Image
                                        src={pkg.image_url}
                                        alt={pkg.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-300">
                                        <Sparkles className="w-16 h-16" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                                <div className="absolute bottom-4 left-6 right-6 text-white">
                                    <h3 className="text-2xl font-black italic uppercase tracking-tight leading-none mb-1">{pkg.name}</h3>
                                    {pkg.title && <p className="text-xs font-bold uppercase tracking-widest opacity-90">{pkg.title}</p>}
                                </div>
                            </div>

                            <CardContent className="flex-1 p-8 space-y-4">
                                <p className="text-neutral-600 leading-relaxed text-sm">
                                    {pkg.description}
                                </p>
                            </CardContent>

                            <CardFooter className="p-8 pt-0 mt-auto flex flex-col gap-3">
                                {pkg.isPurchased && pkg.status && (
                                    <div className="w-full text-center">
                                        <span className={`
                                            inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                            ${pkg.status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                pkg.status === 'processing_plan' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                    'bg-blue-50 text-blue-600 border-blue-200'}
                                       `}>
                                            {pkg.status === 'delivered' ? 'Pronto' :
                                                pkg.status === 'processing_plan' ? 'In Lavorazione' :
                                                    pkg.status === 'pending_appointment' ? 'Da Prenotare' : 'Attivo'}
                                        </span>
                                    </div>
                                )}
                                {pkg.isPurchased ? (
                                    <div className="w-full space-y-3">
                                        <Button className="w-full bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border border-emerald-100 font-bold h-12 rounded-xl shadow-sm" disabled>
                                            <Check className="w-4 h-4 mr-2" />
                                            Già Acquistato
                                        </Button>
                                        <Button
                                            onClick={() => handlePurchase(pkg.id)}
                                            disabled={purchasingId === pkg.id}
                                            variant="outline"
                                            className="w-full border-[#593e25]/20 text-[#593e25] hover:bg-[#593e25]/5 font-bold h-12 rounded-xl transition-all"
                                        >
                                            {purchasingId === pkg.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Acquista di nuovo"
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => handlePurchase(pkg.id)}
                                        disabled={purchasingId === pkg.id}
                                        className="w-full bg-[#593e25] hover:bg-[#4a331f] text-white font-bold h-14 rounded-xl shadow-lg shadow-[#593e25]/20"
                                    >
                                        {purchasingId === pkg.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                Acquista a € {pkg.price}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
