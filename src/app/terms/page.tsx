import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Termini e Condizioni | Rita Zanicchi - Personal Trainer',
    description: 'Termini e condizioni di utilizzo della piattaforma Rita Workout.',
}

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-[var(--bg)] py-20 px-4">
            <article className="max-w-3xl mx-auto prose prose-neutral">
                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Termini e Condizioni</h1>
                <p className="text-sm text-[var(--foreground)]/60 mb-10">Ultimo aggiornamento: Marzo 2026</p>

                <section className="space-y-6 text-[var(--foreground)]/80 text-[15px] leading-relaxed">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">1. Definizioni</h2>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li><strong>&quot;Piattaforma&quot;</strong> — il sito web ritazanicchi-pt.it e l&apos;applicazione web Rita Workout</li>
                            <li><strong>&quot;Titolare&quot;</strong> / <strong>&quot;Fornitore&quot;</strong> — Rita Zanicchi, con sede in <strong>[INDIRIZZO DA COMPLETARE]</strong>, P.IVA <strong>[P.IVA DA COMPLETARE]</strong></li>
                            <li><strong>&quot;Utente&quot;</strong> — qualsiasi persona fisica che accede alla Piattaforma e/o acquista i Servizi</li>
                            <li><strong>&quot;Servizi&quot;</strong> — i pacchetti di video-allenamento, percorsi personalizzati e contenuti digitali disponibili sulla Piattaforma</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">2. Oggetto del Contratto</h2>
                        <p>
                            I presenti Termini e Condizioni regolano l&apos;accesso e l&apos;utilizzo della Piattaforma
                            e l&apos;acquisto dei Servizi offerti dal Titolare. La registrazione e/o l&apos;acquisto
                            comportano l&apos;accettazione integrale dei presenti Termini.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">3. Registrazione e Account</h2>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li>La registrazione è gratuita e richiede un indirizzo email valido e una password.</li>
                            <li>L&apos;Utente è responsabile della custodia delle proprie credenziali di accesso.</li>
                            <li>L&apos;Utente garantisce che le informazioni fornite sono veritiere e si impegna ad aggiornarle in caso di variazione.</li>
                            <li>Il Titolare si riserva di sospendere o cancellare account che violino i presenti Termini.</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">4. Servizi e Prezzi</h2>
                        <p>La Piattaforma offre due tipologie di acquisto:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li>
                                <strong>Abbonamenti mensili</strong> — danno accesso ai video-allenamento per la durata
                                dell&apos;abbonamento. Si rinnovano automaticamente ogni mese fino alla disdetta.
                            </li>
                            <li>
                                <strong>Acquisti una tantum</strong> — percorsi personalizzati o pacchetti speciali
                                con pagamento singolo.
                            </li>
                        </ul>
                        <p className="mt-3">
                            I prezzi sono indicati in Euro (EUR) e includono l&apos;IVA ove applicabile.
                            Il Titolare si riserva di modificare i prezzi in qualsiasi momento; le modifiche
                            non si applicheranno agli abbonamenti già attivi fino al successivo rinnovo.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">5. Pagamenti</h2>
                        <p>
                            I pagamenti sono elaborati tramite <strong>Stripe Inc.</strong>, un sistema di pagamento
                            certificato PCI DSS. Il Titolare non ha accesso ai dati completi delle carte di credito.
                        </p>
                        <p className="mt-3">
                            I metodi di pagamento accettati sono quelli disponibili tramite Stripe (carte di credito/debito,
                            e altri metodi locali supportati).
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">6. Prova Gratuita</h2>
                        <p>
                            Il Titolare può offrire un periodo di prova gratuita di 7 giorni per i nuovi utenti.
                            La prova è limitata a una volta per utente. Al termine del periodo di prova,
                            l&apos;abbonamento si converte automaticamente in abbonamento a pagamento, salvo disdetta
                            prima della scadenza.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">7. Diritto di Recesso</h2>
                        <p>
                            Ai sensi degli articoli 52-59 del D.Lgs. 206/2005 (Codice del Consumo), l&apos;Utente
                            consumatore ha diritto di recedere dal contratto entro <strong>14 giorni</strong> dalla
                            data dell&apos;acquisto, senza dover fornire alcuna motivazione.
                        </p>
                        <p className="mt-3">
                            Per esercitare il diritto di recesso, l&apos;Utente può utilizzare la funzione
                            &quot;Richiedi Rimborso&quot; disponibile nella sezione Billing della dashboard,
                            oppure inviare una comunicazione a <strong>info@ritazanicchi-pt.it</strong>.
                        </p>

                        <div className="bg-[var(--foreground)]/5 border border-[var(--foreground)]/10 rounded-xl p-4 mt-4">
                            <p className="font-bold text-[var(--foreground)] text-sm mb-2">Eccezione per contenuti digitali:</p>
                            <p className="text-sm">
                                Ai sensi dell&apos;art. 59, comma 1, lettera o) del Codice del Consumo, il diritto
                                di recesso è escluso per la fornitura di contenuti digitali non forniti su supporto
                                materiale se l&apos;Utente ha acconsentito all&apos;esecuzione immediata del servizio
                                e ha riconosciuto di perdere il diritto di recesso. L&apos;accesso ai video-allenamento
                                costituisce inizio di fruizione del contenuto digitale.
                            </p>
                        </div>

                        <p className="mt-4">
                            In ogni caso, il rimborso sarà elaborato entro <strong>14 giorni</strong> dalla ricezione
                            della richiesta, utilizzando lo stesso metodo di pagamento dell&apos;acquisto originale.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">8. Disdetta dell&apos;Abbonamento</h2>
                        <p>
                            L&apos;Utente può disdire l&apos;abbonamento in qualsiasi momento dalla sezione
                            Billing della dashboard. La disdetta ha effetto al termine del periodo di fatturazione
                            già pagato. L&apos;accesso ai contenuti resta attivo fino alla scadenza del periodo pagato.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">9. Proprietà Intellettuale</h2>
                        <p>
                            Tutti i contenuti della Piattaforma (video, testi, grafica, loghi, software) sono di
                            proprietà esclusiva del Titolare e sono protetti dalle leggi sul diritto d&apos;autore.
                        </p>
                        <p className="mt-3">
                            L&apos;acquisto di un Servizio conferisce all&apos;Utente una <strong>licenza personale,
                            non trasferibile e non esclusiva</strong> per la visione dei contenuti inclusi nel
                            pacchetto acquistato, limitatamente alla durata dell&apos;abbonamento o del servizio.
                        </p>
                        <p className="mt-3">
                            È <strong>vietato</strong> copiare, riprodurre, distribuire, scaricare, modificare
                            o rendere disponibili a terzi i contenuti della Piattaforma, in tutto o in parte.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">10. Limitazione di Responsabilità</h2>
                        <ul className="list-disc pl-6 space-y-2 mt-3">
                            <li>I contenuti della Piattaforma hanno <strong>finalità informativa e di fitness generale</strong> e non sostituiscono il parere medico.</li>
                            <li>L&apos;Utente è responsabile di verificare la propria idoneità fisica all&apos;attività sportiva prima di seguire gli allenamenti.</li>
                            <li>Il Titolare non è responsabile per eventuali infortuni derivanti dall&apos;esecuzione degli esercizi proposti.</li>
                            <li>Il Titolare non garantisce la disponibilità ininterrotta della Piattaforma e non è responsabile per interruzioni temporanee dovute a manutenzione o cause di forza maggiore.</li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">11. Cancellazione dell&apos;Account</h2>
                        <p>
                            L&apos;Utente può richiedere la cancellazione del proprio account dalla sezione Profilo
                            della dashboard. La richiesta verrà elaborata entro 30 giorni, come previsto dal GDPR.
                            La cancellazione comporta la perdita di tutti i dati, progressi e badge associati all&apos;account.
                            Eventuali abbonamenti attivi verranno disdetti.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">12. Legge Applicabile e Foro Competente</h2>
                        <p>
                            I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia
                            derivante dall&apos;interpretazione o esecuzione dei presenti Termini, è competente
                            il Foro del luogo di residenza dell&apos;Utente consumatore, ai sensi dell&apos;art. 66-bis
                            del Codice del Consumo.
                        </p>
                        <p className="mt-3">
                            L&apos;Utente può inoltre ricorrere alla piattaforma ODR (Online Dispute Resolution)
                            dell&apos;Unione Europea disponibile all&apos;indirizzo:{' '}
                            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer"
                               className="text-[var(--brand)] underline">
                                https://ec.europa.eu/consumers/odr
                            </a>
                        </p>
                    </div>

                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)] mt-10 mb-3">13. Contatti</h2>
                        <p>
                            Per qualsiasi domanda relativa ai presenti Termini, scrivere a:{' '}
                            <strong>info@ritazanicchi-pt.it</strong>
                        </p>
                    </div>
                </section>
            </article>
        </main>
    )
}
