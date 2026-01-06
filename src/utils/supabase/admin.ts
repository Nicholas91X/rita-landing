import { createClient } from '@/utils/supabase/server'

export async function isAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { data } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

    return !!data
}
