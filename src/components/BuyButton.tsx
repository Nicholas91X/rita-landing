'use client'

import { useState } from 'react'
import { createCheckoutSession } from '@/app/actions/stripe'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface BuyButtonProps {
    packageId: string
    price?: number
}

export default function BuyButton({ packageId, price }: BuyButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handlePurchase = async () => {
        try {
            setIsLoading(true)
            // Chiamiamo la Server Action che hai scritto tu
            const checkoutUrl = await createCheckoutSession(packageId)

            // Reindirizziamo l'utente su Stripe
            window.location.href = checkoutUrl
        } catch (error) {
            console.error('Errore durante il checkout:', error)
            alert("Si è verificato un errore. Riprova più tardi.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            onClick={handlePurchase}
            disabled={isLoading}
            className="w-full bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity rounded-full font-semibold"
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Elaborazione...
                </>
            ) : (
                `Sblocca Pacchetto ${price ? `(€${price})` : ''}`
            )}
        </Button>
    )
}