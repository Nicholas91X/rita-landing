import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/utils/supabase/admin'

export const maxDuration = 60; // Set timeout for serverless function

export async function PUT(request: NextRequest, props: { params: Promise<{ libraryId: string, videoId: string }> }) {
    // 1. Security Check
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const params = await props.params;
    const { libraryId, videoId } = params

    if (!libraryId || !videoId) {
        return new NextResponse('Missing parameters', { status: 400 })
    }

    // 2. Get Headers & Config
    const apiKey = process.env.BUNNY_LIBRARY_API_KEY
    if (!apiKey) return new NextResponse('Server Misconfiguration', { status: 500 })

    // 3. Proxy the stream to Bunny
    try {
        const bunnyUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyStream = request.body as any;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetchOptions: any = {
            method: 'PUT',
            headers: {
                'AccessKey': apiKey,
                'Content-Type': 'application/octet-stream',
            },
            body: bodyStream,
            duplex: 'half'
        }

        const response = await fetch(bunnyUrl, fetchOptions)

        if (!response.ok) {
            const err = await response.text()
            console.error('Bunny Upload Error:', err)
            return new NextResponse(err, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)

    } catch (error) {
        console.error('Proxy Error:', error)
        return new NextResponse('Upload Proxy Failed', { status: 500 })
    }
}
