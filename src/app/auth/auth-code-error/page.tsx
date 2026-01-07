'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function ErrorMessage() {
    const searchParams = useSearchParams()
    const [messageData, setMessageData] = useState({
        title: 'Stato Autenticazione',
        text: 'Analisi dello stato...',
        type: 'loading' as 'error' | 'success' | 'info' | 'loading'
    })

    useEffect(() => {
        const errorParam = searchParams.get('error')
        const messageParam = searchParams.get('message')

        const hash = window.location.hash
        let rawMessage = ''
        if (hash) {
            const params = new URLSearchParams(hash.substring(1))
            rawMessage = params.get('message') || params.get('error_description') || ''
        }

        if (!rawMessage) {
            rawMessage = messageParam || errorParam || ''
        }

        const decodedMessage = decodeURIComponent(rawMessage || '').replace(/\+/g, ' ')

        if (decodedMessage.toLowerCase().includes('confirmation link accepted')) {
            setMessageData({
                title: 'Conferma Iniziale Accettata',
                text: 'Per completare il cambio email, controlla ora la tua VECCHIA casella di posta e clicca sul link di conferma che ti abbiamo inviato.',
                type: 'info'
            })
        } else if (decodedMessage.toLowerCase().includes('email link is invalid or has expired')) {
            setMessageData({
                title: 'Link Scaduto',
                text: 'Il link di verifica è scaduto o non è valido. Richiedi un nuovo cambio email dalla tua dashboard.',
                type: 'error'
            })
        } else if (rawMessage) {
            setMessageData({
                title: 'Problema di Autenticazione',
                text: decodedMessage,
                type: 'error'
            })
        } else {
            setMessageData({
                title: 'Errore Sconosciuto',
                text: 'Si è verificato un problema imprevisto.',
                type: 'error'
            })
        }
    }, [searchParams])

    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <div className={`p-4 rounded-full ${messageData.type === 'info' ? 'bg-blue-500/10' :
                        messageData.type === 'success' ? 'bg-green-500/10' :
                            'bg-red-500/10'
                    }`}>
                    {messageData.type === 'info' ? <Info className="w-10 h-10 text-blue-500" /> :
                        messageData.type === 'success' ? <CheckCircle2 className="w-10 h-10 text-green-500" /> :
                            <AlertTriangle className="w-10 h-10 text-red-500" />}
                </div>
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white mb-2">{messageData.title}</h1>
                <p className="text-neutral-400 break-words leading-relaxed">
                    {messageData.text}
                </p>
            </div>
        </div>
    )
}

export default function AuthCodeError() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <Card className="max-w-md w-full bg-neutral-900 border-neutral-800 p-8 text-center">
                <Suspense fallback={<p className="text-neutral-500">Caricamento...</p>}>
                    <ErrorMessage />
                </Suspense>
                <div className="pt-8 bg-neutral-900">
                    <Button asChild className="w-full bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white font-bold h-12 rounded-xl">
                        <Link href="/dashboard">Torna alla Dashboard</Link>
                    </Button>
                </div>
            </Card>
        </div>
    )
}
