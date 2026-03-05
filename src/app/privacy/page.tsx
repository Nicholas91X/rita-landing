import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Privacy Policy | Rita Zanicchi - Personal Trainer',
    description: 'Informativa sulla privacy e sul trattamento dei dati personali ai sensi del GDPR.',
}

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-[var(--bg)] py-20 px-4">
            <article className="max-w-3xl mx-auto prose prose-neutral">
                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Informativa sulla Privacy</h1>
                <p className="text-sm text-[var(--foreground)]/60 mb-10">Ultimo aggiornamento: Marzo 2026</p>

                <section className="space-y-6 text-[var(--foreground)]/80 text-[15px] leading-relaxed">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">1. Titolare del Trattamento</h2>
                        <p>
                            Il Titolare del trattamento dei dati personali è <strong>Rita Zanicchi</strong>, con sede operativa
                            in <strong>[INDIRIZZO DA COMPLETARE]</strong>, P.IVA <strong>[P.IVA DA COMPLETARE]</strong>,
                            email: <strong>info@ritazanicchi-pt.it</strong> (di seguito &quot;Titolare&quot;).
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">2. Dati Raccolti</h2>
                        <p>Il Titolare raccoglie le seguenti categorie di dati personali:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li><strong>Dati di registrazione:</strong> nome, cognome, indirizzo email, password (criptata)</li>
                            <li><strong>Dati di pagamento:</strong> elaborati direttamente da Stripe Inc. Il Titolare non conserva i dati delle carte di credito. Vengono memorizzati solo gli identificativi di transazione necessari per la gestione dell&apos;abbonamento.</li>
                            <li><strong>Dati di utilizzo:</strong> progresso di visione dei video, badge ottenuti, preferenze dell&apos;account</li>
                            <li><strong>Dati tecnici:</strong> indirizzo IP, tipo di browser, sistema operativo (raccolti automaticamente per il funzionamento del servizio)</li>
                            <li><strong>Foto profilo:</strong> caricata volontariamente dall&apos;utente</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">3. Finalità e Base Giuridica del Trattamento</h2>
                        <table className="w-full text-sm border-collapse mt-3">
                            <thead>
                                <tr className="border-b border-[var(--foreground)]/10">
                                    <th className="text-left py-2 pr-4 font-bold">Finalità</th>
                                    <th className="text-left py-2 font-bold">Base giuridica</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--foreground)]/5">
                                <tr><td className="py-2 pr-4">Erogazione del servizio (accesso ai video, gestione abbonamento)</td><td className="py-2">Esecuzione del contratto (Art. 6.1.b GDPR)</td></tr>
                                <tr><td className="py-2 pr-4">Gestione dei pagamenti e fatturazione</td><td className="py-2">Obbligo legale (Art. 6.1.c GDPR)</td></tr>
                                <tr><td className="py-2 pr-4">Comunicazioni di servizio (conferme acquisto, aggiornamenti ordine)</td><td className="py-2">Esecuzione del contratto (Art. 6.1.b GDPR)</td></tr>
                                <tr><td className="py-2 pr-4">Notifiche su badge e progressi</td><td className="py-2">Legittimo interesse (Art. 6.1.f GDPR)</td></tr>
                                <tr><td className="py-2 pr-4">Analisi aggregate delle prestazioni del sito</td><td className="py-2">Legittimo interesse (Art. 6.1.f GDPR)</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">4. Destinatari dei Dati</h2>
                        <p>I dati personali possono essere comunicati ai seguenti soggetti terzi, in qualità di Responsabili del trattamento:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li><strong>Supabase Inc.</strong> — hosting del database e autenticazione (server UE)</li>
                            <li><strong>Stripe Inc.</strong> — elaborazione dei pagamenti (conforme al GDPR, certificato PCI DSS)</li>
                            <li><strong>Bunny.net</strong> — distribuzione dei contenuti video (CDN con server europei)</li>
                            <li><strong>Vercel Inc.</strong> — hosting dell&apos;applicazione web</li>
                            <li><strong>Resend Inc.</strong> — invio di email transazionali</li>
                        </ul>
                        <p className="mt-3">I dati non vengono venduti o condivisi con terzi per finalità di marketing.</p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">5. Trasferimento dei Dati Extra-UE</h2>
                        <p>
                            Alcuni dei fornitori sopra indicati hanno sede negli Stati Uniti. Il trasferimento dei dati avviene
                            sulla base delle Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea e/o
                            del Data Privacy Framework UE-USA, come previsto dal Capo V del GDPR.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">6. Conservazione dei Dati</h2>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li><strong>Dati dell&apos;account:</strong> conservati fino alla cancellazione dell&apos;account da parte dell&apos;utente</li>
                            <li><strong>Dati di pagamento e fatturazione:</strong> conservati per 10 anni come richiesto dalla normativa fiscale italiana</li>
                            <li><strong>Dati di utilizzo:</strong> conservati per la durata dell&apos;abbonamento attivo</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">7. Diritti dell&apos;Interessato</h2>
                        <p>Ai sensi degli articoli 15-22 del GDPR, l&apos;utente ha diritto di:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li><strong>Accesso</strong> — ottenere conferma del trattamento e copia dei propri dati</li>
                            <li><strong>Rettifica</strong> — correggere dati inesatti o incompleti</li>
                            <li><strong>Cancellazione</strong> (&quot;diritto all&apos;oblio&quot;) — richiedere l&apos;eliminazione dei dati dalla sezione Profilo della dashboard</li>
                            <li><strong>Limitazione</strong> — richiedere la limitazione del trattamento</li>
                            <li><strong>Portabilità</strong> — ricevere i propri dati in formato strutturato</li>
                            <li><strong>Opposizione</strong> — opporsi al trattamento basato sul legittimo interesse</li>
                        </ul>
                        <p className="mt-3">
                            Per esercitare questi diritti, scrivere a <strong>info@ritazanicchi-pt.it</strong>.
                            Il Titolare risponderà entro 30 giorni dal ricevimento della richiesta.
                        </p>
                        <p className="mt-3">
                            L&apos;utente ha inoltre il diritto di proporre reclamo al <strong>Garante per la Protezione
                            dei Dati Personali</strong> (www.garanteprivacy.it).
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">8. Cookie e Tecnologie di Tracciamento</h2>
                        <p>Il sito utilizza esclusivamente:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li><strong>Cookie tecnici di sessione</strong> — necessari per l&apos;autenticazione e il funzionamento dell&apos;area riservata. Non richiedono consenso.</li>
                            <li><strong>Vercel Analytics</strong> — servizio di analisi aggregata che <strong>non utilizza cookie</strong> e non traccia gli utenti individuali. Raccoglie solo dati anonimi sulle prestazioni del sito.</li>
                        </ul>
                        <p className="mt-3">
                            Il sito <strong>non utilizza cookie di profilazione</strong> né strumenti di tracciamento pubblicitario.
                            Non è pertanto necessario un banner di consenso cookie ai sensi della Direttiva ePrivacy.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">9. Sicurezza</h2>
                        <p>
                            Il Titolare adotta misure tecniche e organizzative adeguate per proteggere i dati personali,
                            tra cui: crittografia in transito (TLS/HTTPS), autenticazione sicura, controllo degli accessi
                            basato su ruoli, e backup regolari.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">10. Modifiche alla Privacy Policy</h2>
                        <p>
                            Il Titolare si riserva di modificare la presente informativa. In caso di modifiche sostanziali,
                            l&apos;utente verrà informato tramite notifica nell&apos;area riservata o via email.
                            La data dell&apos;ultimo aggiornamento è indicata in cima a questo documento.
                        </p>
                    </div>
                </section>
            </article>
        </main>
    )
}
