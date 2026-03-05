import { NextResponse } from 'next/server'
import { sendWelcomeEmail, sendPurchaseConfirmationEmail, sendOrderStatusEmail } from '@/lib/email'

// TEMPORARY: Remove this file before going live
export async function GET(request: Request) {
    // Only allow in development or with secret param
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const to = searchParams.get('to')
    const type = searchParams.get('type') || 'welcome'

    if (secret !== process.env.RESEND_API_KEY?.slice(-8)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!to) {
        return NextResponse.json({ error: 'Missing "to" param' }, { status: 400 })
    }

    try {
        if (type === 'welcome') {
            await sendWelcomeEmail(to, 'Utente Test')
        } else if (type === 'purchase') {
            await sendPurchaseConfirmationEmail(to, 'Utente Test', 'Pacchetto Demo', 29.99, false)
        } else if (type === 'status') {
            await sendOrderStatusEmail(to, 'Utente Test', 'Pacchetto Demo', 'shipped')
        }

        return NextResponse.json({ success: true, type })
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
