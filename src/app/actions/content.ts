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

    // 1. Recupera gli ID dei pacchetti acquistati
    const { data: subs } = await supabase
        .from('user_subscriptions')
        .select('package_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

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
                    stripe_price_id 
                )
            )
        `)

    if (error) {
        console.error('Error fetching content hierarchy:', error)
        return []
    }

    // 3. Mappatura per aggiungere la flag isPurchased
    const hierarchy = (data as any[]).map(level => ({
        ...level,
        courses: level.courses.map((course: any) => ({
            ...course,
            packages: course.packages.map((pkg: any) => ({
                ...pkg,
                isPurchased: purchasedIds.includes(pkg.id)
            }))
        }))
    }))

    return hierarchy as Level[]
}