'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface TransitionOverlayProps {
    show: boolean
    message?: string
}

export default function TransitionOverlay({ show, message = 'Caricamento...' }: TransitionOverlayProps) {
    const [visible, setVisible] = useState(false)
    const [animate, setAnimate] = useState(false)

    useEffect(() => {
        if (show) {
            setVisible(true)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setAnimate(true))
            })
        } else {
            setAnimate(false)
            const timer = setTimeout(() => setVisible(false), 500)
            return () => clearTimeout(timer)
        }
    }, [show])

    if (!visible) return null

    return (
        <div
            className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-all duration-500 ease-out ${
                animate ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ background: 'linear-gradient(135deg, #001F3D 0%, #0a2d4f 40%, #12364a 100%)' }}
        >
            {/* Ambient glow */}
            <div className={`absolute w-80 h-80 rounded-full bg-[var(--brand)]/20 blur-[120px] transition-all duration-1000 ${
                animate ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`} />

            {/* Logo */}
            <div className={`relative transition-all duration-700 ease-out ${
                animate ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-4'
            }`}>
                <Image
                    src="/logo/logo.png"
                    alt="Rita Workout"
                    width={80}
                    height={80}
                    className="object-contain drop-shadow-[0_0_30px_rgba(244,101,48,0.3)]"
                    priority
                />
            </div>

            {/* Spinner ring */}
            <div className={`mt-8 transition-all duration-700 delay-200 ${
                animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
                <div className="w-8 h-8 border-2 border-white/10 border-t-[var(--brand)] rounded-full animate-spin" />
            </div>

            {/* Message */}
            <p className={`mt-6 text-sm font-bold text-white/60 uppercase tracking-[0.25em] transition-all duration-700 delay-300 ${
                animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
                {message}
            </p>
        </div>
    )
}
