import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { verifyUnsubscribeToken, setMarketingConsent } from '@/lib/marketing-consent'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.fitandsmile.it'

// Minimal styled HTML confirmation page (the recipient isn't logged in).
function page(title: string, body: string, ok: boolean): string {
    return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;background:#f8f5f2;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:60px 20px;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
<tr><td style="background:#593e25;padding:28px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Rita Workout</h1></td></tr>
<tr><td style="padding:40px;text-align:center;">
<div style="font-size:40px;margin-bottom:12px;">${ok ? '✅' : '⚠️'}</div>
<h2 style="margin:0 0 12px;color:#2a2e30;font-size:22px;">${title}</h2>
<p style="color:#555;font-size:15px;line-height:1.7;margin:0;">${body}</p>
<a href="${SITE_URL}/dashboard" style="display:inline-block;margin-top:28px;background:#846047;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 26px;border-radius:999px;">Vai alla tua area personale</a>
</td></tr></table></td></tr></table></body></html>`
}

async function unsubscribe(token: string | null): Promise<NextResponse> {
    if (!token) {
        return new NextResponse(
            page('Link non valido', 'Il link di disiscrizione non è valido o è incompleto.', false),
            { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
    }
    try {
        const { userId } = await verifyUnsubscribeToken(token)
        const admin = await createServiceRoleClient()
        await setMarketingConsent(admin, userId, false)
        return new NextResponse(
            page(
                'Disiscrizione completata',
                'Non riceverai più email di marketing da Fit&amp;Smile. Continuerai a ricevere solo comunicazioni di servizio relative al tuo account.',
                true,
            ),
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
    } catch (err) {
        console.error('[unsubscribe] failed', err)
        return new NextResponse(
            page('Link scaduto o non valido', 'Non è stato possibile elaborare la disiscrizione. Puoi gestire i consensi dal tuo profilo.', false),
            { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
    }
}

// GET — when the user clicks the link in the email.
export async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get('token')
    return unsubscribe(token)
}

// POST — RFC 8058 one-click unsubscribe (List-Unsubscribe-Post header).
export async function POST(request: Request) {
    const token = new URL(request.url).searchParams.get('token')
    return unsubscribe(token)
}
