'use client'

import { useState } from 'react'
import { createCheckoutSession } from '@/app/actions/stripe'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

import { CheckoutConfirmationModal } from './CheckoutConfirmationModal'

interface BuyButtonProps {
    packageId: string
    packageName?: string
    price?: number
    customLabel?: string
    className?: string
}

export default function BuyButton({ packageId, packageName, price, customLabel, className }: BuyButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleConfirm = async () => {
        try {
            setIsLoading(true)
            const checkoutUrl = await createCheckoutSession(packageId)
            window.location.href = checkoutUrl
        } catch (error) {
            console.error('Errore durante il checkout:', error)
            alert("Si è verificato un errore. Riprova più tardi.")
            setIsLoading(false)
        }
    }

    const defaultLabel = `Sblocca Pacchetto ${price ? `(€${price})` : ''}`

    return (
        <>
            <Button
                onClick={() => setIsModalOpen(true)}
                disabled={isLoading}
                className={className || "w-full bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity rounded-full font-semibold"}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Elaborazione...
                    </>
                ) : (
                    customLabel || defaultLabel
                )}
            </Button>

            <CheckoutConfirmationModal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                onConfirm={handleConfirm}
                packageName={packageName || 'Pacchetto'}
                price={price}
                isLoading={isLoading}
            />
        </>
    )
}