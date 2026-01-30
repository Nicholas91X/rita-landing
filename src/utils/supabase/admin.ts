import { createClient } from '@/utils/supabase/server'

export async function isAdmin(userId?: string) {
    const supabase = await createClient()

    let finalUserId = userId
    if (!finalUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return false
        finalUserId = user.id
    }

    const { data } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', finalUserId)
        .single()

    return !!data
}
