"use client";

import Logo from "@/components/Logo";
import Socials from "@/components/Socials";
import { site } from "@/content/it";

export default function MaintenancePage() {
    return (
        <main className="min-h-screen bg-[var(--steel)] text-white flex flex-col items-center justify-center p-6 text-center">
            {/* Background Decor */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--brand)]/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--accent)]/5 blur-[120px] rounded-full"></div>
            </div>

            <div className="relative z-10 max-w-2xl w-full space-y-12">
                {/* Logo Section */}
                <div className="flex flex-col items-center space-y-4">
                    <Logo variant="circle" height={120} padding={12} bg="rgba(255,255,255,1)" className="shadow-2xl" />
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase">
                        {site.brand}
                    </h1>
                </div>

                {/* Message Section */}
                <div className="space-y-6">
                    <div className="inline-block px-4 py-1 rounded-full bg-[var(--brand)]/20 border border-[var(--brand)]/30 text-[var(--brand)] text-xs font-bold uppercase tracking-widest">
                        Manutenzione Programmata
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight italic">
                        Stiamo lavorando <br />
                        per <span className="text-[var(--brand)]">te.</span>
                    </h2>
                    <p className="text-lg md:text-xl text-white/70 max-w-md mx-auto leading-relaxed">
                        Il sito è temporaneamente offline per aggiornamenti. <br />
                        Torniamo tra pochissimo con grandi novità!
                    </p>
                </div>

                {/* Socials Section */}
                <div className="pt-8 flex flex-col items-center space-y-4">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                        Seguici per aggiornamenti
                    </p>
                    <Socials variant="light" size={48} className="gap-4" />
                </div>
            </div>

            {/* Footer info */}
            <div className="absolute bottom-8 text-[10px] uppercase font-bold tracking-[0.2em] text-white/30">
                &copy; {new Date().getFullYear()} {site.brand} &middot; Fit & Smile Method
            </div>
        </main>
    );
}
