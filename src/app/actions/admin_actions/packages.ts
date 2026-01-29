'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import Stripe from 'stripe'
import { revalidateTag } from 'next/cache'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover' as unknown as Stripe.LatestApiVersion,
})

export async function getAdminPackages() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: packages, error } = await supabase
        .from('packages')
        .select(`
            *,
            title,
            payment_mode,
            courses (
                name
            )
        `)
        .order('name')

    if (error) throw new Error(error.message)
    return packages
}

export async function getAdminCourses() {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const supabase = await createClient()
    const { data: courses, error } = await supabase
        .from('courses')
        .select(`
            id,
            name,
            levels (
                name
            )
        `)
        .order('name')

    if (error) throw new Error(error.message)
    return courses
}

export async function createPackage(formData: FormData) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const name = formData.get('name') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priceAmount = parseFloat(formData.get('price') as string)
    const courseId = formData.get('course_id') as string
    const badgeType = formData.get('badge_type') as string
    const paymentMode = formData.get('payment_mode') as 'subscription' | 'payment' || 'subscription'
    const imageFile = formData.get('image') as File

    const product = await stripe.products.create({
        name: name,
        description: description,
    })

    const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(priceAmount * 100),
        currency: 'eur',
        recurring: paymentMode === 'subscription' ? {
            interval: 'month',
        } : undefined,
    })

    const supabase = await createClient()
    let imageUrl = null

    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage
            .from('package-images')
            .upload(fileName, imageFile)

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
                .from('package-images')
                .getPublicUrl(fileName)
            imageUrl = publicUrl
        }
    }

    const { error } = await supabase
        .from('packages')
        .insert({
            name: name,
            title: title || null,
            description: description,
            price: priceAmount,
            course_id: courseId,
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            badge_type: badgeType,
            payment_mode: paymentMode,
            image_url: imageUrl
        })

    if (error) throw new Error(error.message)
    revalidateTag('admin-stats')
    return { success: true }
}

export async function updatePackage(id: string, formData: FormData) {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) throw new Error('Unauthorized')

    const name = formData.get('name') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const priceAmount = parseFloat(formData.get('price') as string)
    const courseId = formData.get('course_id') as string
    const badgeType = formData.get('badge_type') as string
    const paymentMode = formData.get('payment_mode') as 'subscription' | 'payment' || 'subscription'
    const imageFile = formData.get('image') as File
    const removeImage = formData.get('removeImage') === 'true'

    const supabase = await createClient()

    const { data: currentPkg } = await supabase
        .from('packages')
        .select('stripe_product_id, price, stripe_price_id, image_url')
        .eq('id', id)
        .single()

    if (!currentPkg) throw new Error('Package not found')

    let newStripePriceId = currentPkg.stripe_price_id
    let newImageUrl = currentPkg.image_url

    if (currentPkg.stripe_product_id) {
        await stripe.products.update(currentPkg.stripe_product_id, {
            name: name,
            description: description
        })
    }

    if (priceAmount !== currentPkg.price && currentPkg.stripe_product_id) {
        const price = await stripe.prices.create({
            product: currentPkg.stripe_product_id,
            unit_amount: Math.round(priceAmount * 100),
            currency: 'eur',
            recurring: paymentMode === 'subscription' ? {
                interval: 'month',
            } : undefined,
        })
        newStripePriceId = price.id
        await stripe.products.update(currentPkg.stripe_product_id, {
            default_price: price.id
        })
    }

    if (removeImage || (imageFile && imageFile.size > 0)) {
        if (currentPkg.image_url) {
            const oldFileName = currentPkg.image_url.split('/').pop()
            if (oldFileName) {
                await supabase.storage.from('package-images').remove([oldFileName])
            }
        }
        newImageUrl = null
    }

    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const { error: uploadError } = await supabase.storage
            .from('package-images')
            .upload(fileName, imageFile)

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
                .from('package-images')
                .getPublicUrl(fileName)
            newImageUrl = publicUrl
        }
    }

    const { error } = await supabase
        .from('packages')
        .update({
            name: name,
            title: title || null,
            description: description,
            price: priceAmount,
            course_id: courseId,
            stripe_price_id: newStripePriceId,
            badge_type: badgeType,
            payment_mode: paymentMode,
            image_url: newImageUrl
        })
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidateTag('admin-stats')
    return { success: true }
}
