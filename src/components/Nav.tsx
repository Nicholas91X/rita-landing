"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { Phone } from "lucide-react";
import Socials from "@/components/Socials";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

const CTA_WA =
  "https://wa.me/393472292627?text=Ciao%20Rita%2C%20vorrei%20prenotare%20una%20consulenza%20gratuita";

export default function Nav() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkUser();
  }, []);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  // Hide Nav on dashboard and admin - Moved after hooks to fix Rules of Hooks error
  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
    return null;
  }

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-[var(--steel)] text-white backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2">
          {/* Main Bar */}
          <div className="h-22 lg:h-20 flex items-center justify-between gap-3">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <Logo variant="circle" height={60} showText={false} />
              <div className="flex flex-col justify-center">
                <Link
                  href="/"
                  className="inline-block text-xl md:text-2xl font-semibold tracking-tight leading-tight"
                  onClick={closeMenu}
                >
                  Rita Zanicchi {"\u00B7"} PT
                </Link>
                <div className="lg:hidden flex mt-2">
                  <Socials variant="light" size={28} className="gap-3" />
                </div>
              </div>
            </div>

            {/* Desktop Nav (Visible lg+) */}
            <nav className="hidden lg:flex items-center gap-8 text-lg">
              <Link href="/#metodo" className="hover:text-[var(--brand)] transition-colors">Metodo</Link>
              <Link href="/pacchetti" className="hover:text-[var(--brand)] transition-colors">Pacchetti</Link>
              <Link href="/#faq" className="hover:text-[var(--brand)] transition-colors">FAQ</Link>
              <Link href="/#contatti" className="hover:text-[var(--brand)] transition-colors">Contatti</Link>
              <Link href="/dashboard" className="font-medium text-[var(--brand)] hover:text-white transition-colors">
                {isLoggedIn ? "Area Riservata" : "Accedi"}
              </Link>
            </nav>

            {/* Desktop Actions (Visible lg+) */}
            <div className="hidden lg:flex items-center gap-4">
              <Socials variant="light" />
              <Button
                asChild
                className="rounded-full px-6 bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90 border-0"
              >
                <a href={CTA_WA}>Prenota consulenza</a>
              </Button>
            </div>

            {/* Mobile/Tablet Menu Trigger (Visible < lg) */}
            <button
              className="lg:hidden p-2 -mr-2 text-white hover:text-[var(--brand)] transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Menu"
            >
              <div className="space-y-1.5">
                <span className="block w-8 h-0.5 bg-current"></span>
                <span className="block w-8 h-0.5 bg-current"></span>
                <span className="block w-8 h-0.5 bg-current"></span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`
            fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-500
            ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={closeMenu}
      />

      {/* Mobile Drawer Panel (Left to Right) */}
      <div
        className={`
            fixed top-0 left-0 bottom-0 z-50 w-[75%] max-w-sm bg-[var(--steel)] text-white shadow-2xl
            flex flex-col transform transition-transform duration-500 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Drawer Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <span className="font-bold text-lg tracking-wider">MENU</span>
          <button onClick={closeMenu} className="p-2 hover:text-[var(--brand)] transition-colors">
            {/* Close Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto py-8 px-6 flex flex-col gap-6">
          <nav className="flex flex-col gap-6 text-xl font-medium">
            <Link href="/#metodo" onClick={closeMenu} className="hover:text-[var(--brand)] transition-colors">Metodo</Link>
            <Link href="/pacchetti" onClick={closeMenu} className="hover:text-[var(--brand)] transition-colors">Pacchetti</Link>
            <Link href="/#faq" onClick={closeMenu} className="hover:text-[var(--brand)] transition-colors">FAQ</Link>
            <Link href="/#contatti" onClick={closeMenu} className="hover:text-[var(--brand)] transition-colors">Contatti</Link>
          </nav>

          <div className="mt-8 pt-8 border-t border-white/10 space-y-6">
            <Link
              href="/dashboard"
              onClick={closeMenu}
              className="flex items-center gap-3 text-[var(--brand)] font-bold text-xl hover:opacity-80"
            >
              {/* User Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              {isLoggedIn ? "Area Riservata" : "Accedi / Registrati"}
            </Link>

            <div className="space-y-4">
              <Button asChild className="w-full rounded-full bg-[var(--brand)] hover:bg-[var(--brand)]/90 border-0 h-12 text-base">
                <a href={CTA_WA}>Prenota consulenza</a>
              </Button>

              <div className="flex items-center gap-4 text-sm text-white/60">
                <Phone className="h-4 w-4" />
                <a href="tel:393472292627" className="hover:text-white transition-colors">+39 347 229 2627</a>
              </div>
            </div>

            <div className="pt-6 pb-4">
              <Socials variant="light" size={32} className="gap-5" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
