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
      <a href={waLink(phone, message)}>{children}</a>
    </Button>
  );
}

export function CtaRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap gap-3">{children}</div>;
}
