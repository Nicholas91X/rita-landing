"use client";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

export default function Footer() {
  const pathname = usePathname();

  // Hide Footer on dashboard and admin
  if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="relative z-10 border-t mt-10 bg-[var(--steel)] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          <Logo variant="circle" height={56} showText={false} />
          <span>
            © {new Date().getFullYear()} Rita Zanicchi – Personal Trainer
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a className="underline" href="#privacy">
            Privacy
          </a>
          <a className="underline" href="#terms">
            Termini
          </a>
        </div>
      </div>
    </footer>
  );
}
