'use server'

import { createClient } from '@/utils/supabase/server'
import { isAdmin } from '@/utils/supabase/admin'
import Stripe from 'stripe'
import { revalidateTag } from 'next/cache'
import { createPackageSchema, updatePackageSchema } from './packages.schemas'
import { validate, ValidationError, formDataToObject } from '@/lib/security/validation'
import type { ActionResult } from '@/lib/security/types'

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

export async function createPackage(formData: FormData): Promise<ActionResult<{ id: string }>> {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) return { ok: false, message: 'Unauthorized' }

    const imageFile = formData.get('image') as File | null
    const textData = formDataToObject(formData)
    delete (textData as Record<string, unknown>).image

    let parsed
    try {
        parsed = validate(createPackageSchema, textData)
    } catch (err) {
        if (err instanceof ValidationError) {
            return { ok: false, message: 'Dati non validi', fieldErrors: err.fieldErrors }
        }
        throw err
    }

    const { name, title, description, price: priceAmount, course_id: courseId, badge_type: badgeType, payment_mode: paymentMode } = parsed

    const product = await stripe.products.create({
        name,
        description,
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
    let imageUrl: string | null = null

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

    const { data: inserted, error } = await supabase
        .from('packages')
        .insert({
            name,
            title: title || null,
            description,
            price: priceAmount,
            course_id: courseId,
            stripe_product_id: product.id,
            stripe_price_id: price.id,
            badge_type: badgeType || null,
            payment_mode: paymentMode,
            image_url: imageUrl
        })
        .select('id')
        .single()

    if (error) return { ok: false, message: error.message }
    revalidateTag('admin-stats')
    return { ok: true, data: { id: inserted.id } }
}

export async function updatePackage(id: string, formData: FormData): Promise<ActionResult<void>> {
    const isSuperAdmin = await isAdmin()
    if (!isSuperAdmin) return { ok: false, message: 'Unauthorized' }

    const imageFile = formData.get('image') as File | null
    const textData = formDataToObject(formData)
    delete (textData as Record<string, unknown>).image

    let parsed
    try {
        parsed = validate(updatePackageSchema, textData)
    } catch (err) {
        if (err instanceof ValidationError) {
            return { ok: false, message: 'Dati non validi', fieldErrors: err.fieldErrors }
        }
        throw err
    }

    const { name, title, description, price: priceAmount, course_id: courseId, badge_type: badgeType, payment_mode: paymentMode } = parsed
    const removeImage = parsed.removeImage === 'true'

    const supabase = await createClient()

    const { data: currentPkg } = await supabase
        .from('packages')
        .select('stripe_product_id, price, stripe_price_id, image_url')
        .eq('id', id)
        .single()

    if (!currentPkg) return { ok: false, message: 'Package not found' }

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
            name,
            title: title || null,
            description,
            price: priceAmount,
            course_id: courseId,
            stripe_price_id: newStripePriceId,
            badge_type: badgeType || null,
            payment_mode: paymentMode,
            image_url: newImageUrl
        })
        .eq('id', id)

    if (error) return { ok: false, message: error.message }
    revalidateTag('admin-stats')
    return { ok: true, data: undefined }
}
