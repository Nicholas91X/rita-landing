import Image from 'next/image'

export default function AdminLoading() {
    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
        >
            <div className="absolute w-80 h-80 rounded-full bg-[var(--brand)]/20 blur-[120px] animate-pulse" />

            <div className="relative animate-in fade-in zoom-in-75 duration-700">
                <Image
                    src="/logo/logo.png"
                    alt="Rita Workout"
                    width={80}
                    height={80}
                    className="object-contain drop-shadow-[0_0_30px_rgba(244,101,48,0.3)]"
                    priority
                />
            </div>

            <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
                <div className="w-8 h-8 border-2 border-white/10 border-t-[var(--brand)] rounded-full animate-spin" />
            </div>

            <p className="mt-6 text-sm font-bold text-white/60 uppercase tracking-[0.25em] animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
                Caricamento pannello admin...
            </p>
        </div>
    )
}
