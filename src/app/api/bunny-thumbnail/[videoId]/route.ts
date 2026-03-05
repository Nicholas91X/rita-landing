import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ videoId: string }> }
) {
    const params = await props.params

    const bunnyVideoId = params.videoId
    const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'

    if (!cdnHostname || !bunnyVideoId) {
        return NextResponse.json({ error: 'Missing config' }, { status: 500 })
    }

    const thumbnailUrl = `https://${cdnHostname}/${bunnyVideoId}/preview.webp`

    try {
        // Bunny ha "Block direct URL file access" abilitato:
        // serve un Referer header che corrisponda ai domini consentiti
        const response = await fetch(thumbnailUrl, {
            headers: {
                'Referer': siteUrl,
            },
        })

        if (response.ok) {
            const imageBuffer = await response.arrayBuffer()
            return new NextResponse(imageBuffer, {
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'image/webp',
                    'Cache-Control': 'public, max-age=21600', // 6 ore
                },
            })
        }

        // Fallback: thumbnail .jpg
        const jpgUrl = `https://${cdnHostname}/${bunnyVideoId}/thumbnail.jpg`
        const jpgResponse = await fetch(jpgUrl, {
            headers: { 'Referer': siteUrl },
        })

        if (jpgResponse.ok) {
            const imageBuffer = await jpgResponse.arrayBuffer()
            return new NextResponse(imageBuffer, {
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Cache-Control': 'public, max-age=21600',
                },
            })
        }

        return NextResponse.json({ error: 'Thumbnail not found', status: response.status }, { status: 404 })

    } catch (err) {
        console.error('[bunny-thumbnail] fetch error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
