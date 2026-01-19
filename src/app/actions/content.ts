'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

// Tipi allineati al Database (usano 'name')
export type Package = {
    id: string
    name: string
    description: string
    course_id: string
    stripe_price_id: string
    price: number;
    image_url: string | null;
    isPurchased?: boolean
}

export type Course = {
    id: string
    name: string
    level_id: string
    packages: Package[]
}

export type Level = {
    id: string
    name: string
    courses: Course[]
}

export async function getContentHierarchy() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // 1. Recupera gli ID dei pacchetti acquistati (inclusi quelli in prova)
    const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('package_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])

    const purchasedIds = subs?.map(s => s.package_id) || []

    // 2. Query con i nomi colonne corretti (name invece di title)
    const { data, error } = await supabase
        .from('levels')
        .select(`
            id, 
            name,
            courses (
                id, 
                name,
                packages ( 
                    id, 
                    name, 
                    description, 
                    stripe_price_id,
                    price,
                    image_url
                )
            )
        `)

    if (error) {
        console.error('Error fetching content hierarchy:', error)
        return []
    }

    // 3. Mappatura per aggiungere la flag isPurchased
    const typedData = (data as unknown) as Array<{
        id: string;
        name: string;
        courses: Array<{
            id: string;
            name: string;
            packages: Array<{
                id: string;
                name: string;
                description: string;
                stripe_price_id: string;
                price: number;
                image_url: string | null;
            }>;
        }>;
    }>;

    const hierarchy = (typedData || []).map((level) => ({
        ...level,
        courses: (level.courses || []).map((course) => ({
            ...course,
            packages: (course.packages || []).map((pkg) => ({
                ...pkg,
                isPurchased: purchasedIds.includes(pkg.id)
            }))
        }))
    }))

    return hierarchy as Level[]
}

export async function getPublicContentHierarchy() {
    const supabase = await createClient()

    // Query con i nomi colonne corretti
    const { data, error } = await supabase
        .from('levels')
        .select(`
            id, 
            name,
            courses (
                id, 
                name,
                packages ( 
                    id, 
                    name, 
                    description, 
                    stripe_price_id,
                    price,
                    image_url
                )
            )
        `)

    if (error) {
        console.error('Error fetching public content hierarchy:', error)
        return []
    }

    // Mappatura per struttura coerente (isPurchased = false per default)
    const typedData = (data as unknown) as Array<{
        id: string;
        name: string;
        courses: Array<{
            id: string;
            name: string;
            packages: Array<{
                id: string;
                name: string;
                description: string;
                stripe_price_id: string;
                price: number;
                image_url: string | null;
            }>;
        }>;
    }>;

    const hierarchy = (typedData || []).map((level) => ({
        ...level,
        courses: (level.courses || []).map((course) => ({
            ...course,
            packages: (course.packages || []).map((pkg) => ({
                ...pkg,
                isPurchased: false
            }))
        }))
    }))

    return hierarchy as Level[]
}