'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { requestLeadMagicLink } from '@/app/actions/lead'
import {
  leadFormSchema,
  type LeadFormInput,
  type LeadFormParsed,
} from '@/app/actions/lead.schemas'
import { Button } from '@/components/ui/button'

export default function LeadCaptureForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormInput, unknown, LeadFormParsed>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { lead_source: 'landing' },
  })
  const [success, setSuccess] = useState(false)

  const onSubmit = handleSubmit(async (values) => {
    const fd = new FormData()
    fd.append('full_name', values.full_name)
    fd.append('email', values.email)
    fd.append('terms_accepted', values.terms_accepted)
    if (values.marketing_consent) fd.append('marketing_consent', values.marketing_consent)
    if (values.lead_source) fd.append('lead_source', values.lead_source)

    const res = await requestLeadMagicLink(fd)
    if (!res.ok) {
      toast.error(res.message)
      return
    }
    setSuccess(true)
  })

  return (
    <section id="form" className="relative py-24 px-6 overflow-hidden">
      <Image
        src="/lead-magnet/form-bg.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center z-0"
      />
      <div className="absolute inset-0 bg-black/50 z-10" />

      <div className="relative z-20 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white leading-snug">
          Ritrova il tuo equilibrio naturale e una nuova sensazione di leggerezza con il{' '}
          <span className="text-[var(--brand)]">percorso gratuito in 3 video</span>
        </h2>

        <p className="mt-4 text-white uppercase tracking-widest text-xs font-bold">
          Inserisci i tuoi dati per ricevere i 3 video del &ldquo;Rituale della Leggerezza&rdquo;
        </p>

        <div className="mt-10 bg-white rounded-2xl p-8 shadow-xl text-left">
          {success ? (
            <div className="text-center py-10 space-y-4">
              <h3 className="text-2xl font-bold text-[var(--secondary)]">Controlla la tua email</h3>
              <p className="text-neutral-700">
                Ti abbiamo inviato il magic link per accedere ai 3 video.<br />
                Hai 14 giorni di tempo per fruirne.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="full_name" className="block text-sm font-semibold text-neutral-700">
                  Nome
                </label>
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  {...register('full_name')}
                  className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--brand)] outline-none"
                />
                {errors.full_name && (
                  <p className="text-red-600 text-xs mt-1">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-neutral-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--brand)] outline-none"
                />
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value="on"
                  {...register('terms_accepted')}
                  className="mt-1"
                />
                <span className="text-xs text-neutral-600">
                  Accetto i{' '}
                  <a href="/terms" target="_blank" className="text-[var(--brand)] underline">
                    Termini
                  </a>{' '}
                  e la{' '}
                  <a href="/privacy" target="_blank" className="text-[var(--brand)] underline">
                    Privacy Policy
                  </a>{' '}
                  (obbligatorio)
                </span>
              </label>
              {errors.terms_accepted && (
                <p className="text-red-600 text-xs">{errors.terms_accepted.message}</p>
              )}

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value="on"
                  {...register('marketing_consent')}
                  className="mt-1"
                />
                <span className="text-xs text-neutral-600">
                  Voglio ricevere consigli, novit&agrave; e offerte da Fit&amp;Smile via email (puoi
                  disiscriverti in qualsiasi momento)
                </span>
              </label>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 mt-4 rounded-xl bg-[var(--brand)] hover:opacity-90 text-white font-bold tracking-wider uppercase text-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Inizia il tuo viaggio'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
