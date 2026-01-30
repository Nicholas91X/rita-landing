"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { waLink } from "@/utils/whatsapp";

type WhatsAppProps = {
  phone?: string;
  message?: string;
  children?: React.ReactNode;
  className?: string;
};

export function CtaWhatsApp({
  phone = "+39 347 229 2627",
  message = "Ciao Rita! Vorrei prenotare una consulenza gratuita.",
  children = "Scrivimi su WhatsApp",
  className,
}: WhatsAppProps) {
  return (
    <Button asChild className={className}>
      <a
        className="inline-flex items-center rounded-full px-5 py-3 text-sm font-medium
+               bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 border-1 border-black"
        href={waLink(phone, message)}
      >
        {children}
      </a>
    </Button>
  );
}

export function CtaRow({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return <div className={`mt-6 flex flex-wrap gap-3 ${className}`}>{children}</div>;
}
