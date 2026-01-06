'use client'

import { useState } from 'react'
import { createBunnyVideo, saveVideoToDb } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react'

type Package = {
    id: string
    name: string
}

export default function AdminDashboardClient({ packages, libraryId }: { packages: Package[], libraryId?: string }) {
    const [title, setTitle] = useState('')
    const [selectedPackage, setSelectedPackage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [status, setStatus] = useState<'idle' | 'creating' | 'uploading' | 'saving' | 'success' | 'error'>('idle')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [uploadProgress, setUploadProgress] = useState(0)

    const handleUpload = async () => {
        if (!title || !selectedPackage || !file) return

        try {
            setStatus('creating')

            // 1. Create Video Placeholder in Bunny
            const bunnyVideo = await createBunnyVideo(title)
            const videoId = bunnyVideo.guid

            // 2. Upload File via Proxy
            setStatus('uploading')

            const proxyUrl = `/api/admin/bunny-proxy/${libraryId}/${videoId}`

            const uploadResponse = await fetch(proxyUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: file
            })

            if (!uploadResponse.ok) {
                const errText = await uploadResponse.text()
                throw new Error(`Upload failed: ${errText}`)
            }

            setStatus('saving')

            // 3. Save to DB
            await saveVideoToDb({
                title,
                bunnyId: videoId,
                packageId: selectedPackage
            })

            setStatus('success')
            setFile(null)
            setTitle('')
        } catch (error) {
            console.error(error)
            setStatus('error')
        }
    }

    return (
        <Card className="max-w-xl mx-auto mt-8 relative overflow-hidden">
            {status === 'creating' || status === 'uploading' || status === 'saving' ? (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8">
                    <Loader2 className="h-12 w-12 text-[var(--brand)] animate-spin mb-4" />
                    <p className="text-xl font-semibold animate-pulse">
                        {status === 'creating' && 'Inizializzazione...'}
                        {status === 'uploading' && 'Caricamento su Bunny...'}
                        {status === 'saving' && 'Salvataggio nel Database...'}
                    </p>
                </div>
            ) : null}

            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UploadCloud className="h-6 w-6" />
                    Carica Nuova Lezione
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {status === 'success' && (
                    <div className="bg-green-100 text-green-700 p-4 rounded-xl flex items-center gap-2 mb-4">
                        <CheckCircle className="h-5 w-5" />
                        Video caricato e salvato con successo!
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-red-100 text-red-700 p-4 rounded-xl flex items-center gap-2 mb-4">
                        <AlertCircle className="h-5 w-5" />
                        Errore durante il caricamento. Riprova.
                    </div>
                )}

                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Titolo Video
                    </label>
                    <input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Es. Lezione 1: Fondamentali"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="package" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Pacchetto
                    </label>
                    <select
                        id="package"
                        value={selectedPackage}
                        onChange={(e) => setSelectedPackage(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="" disabled>Seleziona un pacchetto</option>
                        {packages.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label htmlFor="file" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        File Video
                    </label>
                    <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:bg-[var(--panel)] transition-colors cursor-pointer relative">
                        <input
                            id="file"
                            type="file"
                            accept="video/*"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        {file ? (
                            <div className="text-[var(--brand)] font-semibold">
                                {file.name}
                            </div>
                        ) : (
                            <div className="text-[var(--muted-foreground)]">
                                <UploadCloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Clicca o trascina il video qui</p>
                            </div>
                        )}
                    </div>
                </div>

                <Button
                    onClick={handleUpload}
                    disabled={!title || !selectedPackage || !file || status !== 'idle' && status !== 'success' && status !== 'error'}
                    className="w-full bg-[var(--brand)] text-white hover:opacity-90"
                >
                    Avvia Upload
                </Button>
            </CardContent>
        </Card>
    )
}
