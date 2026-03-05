import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'Rita Workout <noreply@ritazanicchi-pt.it>'
const SUPPORT_EMAIL = 'info@ritazanicchi-pt.it'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ritazanicchi-pt.it'

// Shared email wrapper with brand styling
function emailLayout(content: string) {
    return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f5f2;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5f2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <!-- Header -->
    <tr><td style="background:#593e25;padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Rita Workout</h1>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:40px;">
        ${content}
    </td></tr>
    <!-- Footer -->
    <tr><td style="background:#f8f5f2;padding:24px 40px;text-align:center;border-top:1px solid #e8e0d8;">
        <p style="margin:0 0 8px;color:#846047;font-size:12px;">Rita Zanicchi - Personal Trainer</p>
        <p style="margin:0;color:#a89888;font-size:11px;">
            <a href="${SITE_URL}" style="color:#846047;text-decoration:underline;">ritazanicchi-pt.it</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#846047;text-decoration:underline;">${SUPPORT_EMAIL}</a>
        </p>
        <p style="margin:12px 0 0;color:#c4b8ac;font-size:10px;">Ricevi questa email perch&eacute; hai un account su Rita Workout.</p>
    </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function button(text: string, url: string) {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td align="center">
    <a href="${url}" style="display:inline-block;background:#F46530;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;letter-spacing:1px;text-transform:uppercase;">${text}</a>
</td></tr></table>`
}

// ─── Email Functions ───

export async function sendWelcomeEmail(to: string, name: string) {
    const html = emailLayout(`
        <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">Benvenuta, ${name || 'cara'}!</h2>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Il tuo account su <strong>Rita Workout</strong> &egrave; stato creato con successo.
        </p>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Sei pronta per iniziare il tuo percorso di benessere? Esplora i pacchetti disponibili e trova quello perfetto per te.
        </p>
        ${button('Esplora i Pacchetti', `${SITE_URL}/pacchetti`)}
        <p style="color:#999;font-size:13px;margin-top:24px;">
            Se hai domande, rispondi a questa email o scrivici a <a href="mailto:${SUPPORT_EMAIL}" style="color:#846047;">${SUPPORT_EMAIL}</a>.
        </p>
    `)

    return resend.emails.send({ from: FROM_EMAIL, to, subject: 'Benvenuta su Rita Workout!', html })
}

export async function sendPurchaseConfirmationEmail(to: string, name: string, packageName: string, amount: number, isTrial: boolean) {
    const priceText = isTrial
        ? '<span style="color:#16a34a;font-weight:700;">Gratis (7 giorni di prova)</span>'
        : `<span style="font-weight:700;">&euro;${(amount / 100).toFixed(2)}</span>`

    const html = emailLayout(`
        <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">
            ${isTrial ? 'Prova Gratuita Attivata!' : 'Conferma di Acquisto'}
        </h2>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Ciao <strong>${name || 'cara'}</strong>,<br>
            ${isTrial
            ? `la tua prova gratuita per <strong>&quot;${packageName}&quot;</strong> &egrave; ora attiva.`
            : `il tuo acquisto di <strong>&quot;${packageName}&quot;</strong> &egrave; stato confermato.`}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f8f5f2;border-radius:12px;padding:20px;">
        <tr><td>
            <p style="margin:0 0 8px;color:#846047;font-size:12px;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Riepilogo</p>
            <p style="margin:0 0 4px;color:#2a2e30;font-size:15px;"><strong>Pacchetto:</strong> ${packageName}</p>
            <p style="margin:0;color:#2a2e30;font-size:15px;"><strong>Importo:</strong> ${priceText}</p>
        </td></tr></table>
        ${button('Vai alla Dashboard', `${SITE_URL}/dashboard`)}
        <p style="color:#999;font-size:13px;">
            ${isTrial ? 'Al termine dei 7 giorni, l\'abbonamento si rinnover&agrave; automaticamente.' : 'Puoi gestire il tuo abbonamento dalla sezione Billing della dashboard.'}
        </p>
    `)

    const subject = isTrial
        ? `Prova gratuita attivata: ${packageName}`
        : `Conferma acquisto: ${packageName}`

    return resend.emails.send({ from: FROM_EMAIL, to, subject, html })
}

export async function sendOrderStatusEmail(to: string, name: string, packageName: string, newStatus: string) {
    const statusLabels: Record<string, { label: string; color: string }> = {
        'ordered': { label: 'Preso in carico', color: '#846047' },
        'shipped': { label: 'In preparazione', color: '#2563eb' },
        'delivered': { label: 'Consegnato e Pronto', color: '#16a34a' },
        'paid': { label: 'Pagamento ricevuto', color: '#846047' },
        'canceled': { label: 'Annullato', color: '#dc2626' },
    }

    const status = statusLabels[newStatus] || { label: newStatus, color: '#846047' }

    const html = emailLayout(`
        <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">Aggiornamento Ordine</h2>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Ciao <strong>${name || 'cara'}</strong>,<br>
            il tuo pacchetto <strong>&quot;${packageName}&quot;</strong> ha un nuovo stato:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f8f5f2;border-radius:12px;padding:20px;text-align:center;">
        <tr><td>
            <p style="margin:0;color:${status.color};font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">${status.label}</p>
        </td></tr></table>
        ${button('Vai alla Dashboard', `${SITE_URL}/dashboard`)}
    `)

    return resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `Ordine "${packageName}": ${status.label}`,
        html,
    })
}

export async function sendSubscriptionExpiringEmail(to: string, name: string, packageName: string, expiryDate: string) {
    const html = emailLayout(`
        <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">Il tuo abbonamento sta per scadere</h2>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Ciao <strong>${name || 'cara'}</strong>,<br>
            il tuo abbonamento a <strong>&quot;${packageName}&quot;</strong> scadr&agrave; il <strong>${expiryDate}</strong>.
        </p>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Se hai impostato la disdetta, l'accesso ai contenuti terminer&agrave; a quella data. Se vuoi continuare il tuo percorso, puoi riattivare l'abbonamento dalla dashboard.
        </p>
        ${button('Gestisci Abbonamento', `${SITE_URL}/dashboard?tab=billing`)}
    `)

    return resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `Abbonamento "${packageName}" in scadenza`,
        html,
    })
}

export async function sendBadgeEarnedEmail(to: string, name: string, packageName: string, badgeType: string) {
    const html = emailLayout(`
        <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">Nuovo Badge Sbloccato!</h2>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Complimenti <strong>${name || 'cara'}</strong>!<br>
            Hai completato tutti i video di <strong>&quot;${packageName}&quot;</strong> e hai ottenuto il badge <strong>${badgeType.toUpperCase()}</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;text-align:center;">
        <tr><td>
            <div style="display:inline-block;width:80px;height:80px;border-radius:50%;border:3px double #846047;line-height:80px;text-align:center;font-size:20px;font-weight:900;color:#846047;text-transform:uppercase;letter-spacing:2px;">${badgeType.substring(0, 4)}</div>
        </td></tr></table>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Continua cos&igrave;! Ogni traguardo raggiunto &egrave; un passo in pi&ugrave; verso il tuo benessere.
        </p>
        ${button('Vedi i tuoi Badge', `${SITE_URL}/dashboard?tab=profile&profileTab=badges`)}
    `)

    return resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `Nuovo badge sbloccato: ${badgeType.toUpperCase()}`,
        html,
    })
}

export async function sendRefundRequestEmail(to: string, name: string, packageName: string) {
    const html = emailLayout(`
        <h2 style="margin:0 0 16px;color:#2a2e30;font-size:24px;">Richiesta di Rimborso Ricevuta</h2>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            Ciao <strong>${name || 'cara'}</strong>,<br>
            abbiamo ricevuto la tua richiesta di rimborso per <strong>&quot;${packageName}&quot;</strong>.
        </p>
        <p style="color:#555;font-size:15px;line-height:1.7;">
            La esamineremo il prima possibile e ti contatteremo via email con l'esito. I tempi di gestione sono generalmente di 3-5 giorni lavorativi.
        </p>
        <p style="color:#999;font-size:13px;margin-top:24px;">
            Per qualsiasi domanda, scrivici a <a href="mailto:${SUPPORT_EMAIL}" style="color:#846047;">${SUPPORT_EMAIL}</a>.
        </p>
    `)

    return resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `Richiesta di rimborso ricevuta: ${packageName}`,
        html,
    })
}
