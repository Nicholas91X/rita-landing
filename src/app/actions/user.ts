'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function getUserSubscriptionInfo() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select(`
            id, 
            status, 
            current_period_end,
            packages ( 
                name, 
                description,
                price
            )
        `)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error fetching user subscriptions:', error)
        return []
    }

    // Map the data to match what the UI expects
    return subs.map(sub => ({
        ...sub,
        next_invoice: sub.current_period_end,
        amount: Number((sub.packages as any)?.price || 0),
        interval: 'mese' // Default interval
    }))
}

export async function getUserProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return {
        user,
        profile
    }
}
export async function signOutUser() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
