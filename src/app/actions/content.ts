'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export type Package = {
    id: string
    title: string
    description: string
    price: number
    course_id: string
}

export type Course = {
    id: string
    title: string
    description: string
    level_id: string
    packages: Package[]
}

export type Level = {
    id: string
    title: string
    description: string
    courses: Course[]
}

export async function getContentHierarchy() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data, error } = await supabase
        .from('levels')
        .select(`
      id,
      title,
      description,
      courses (
        id,
        title,
        description,
        packages (
          id,
          title,
          description,
          price
        )
      )
    `)

    if (error) {
        console.error('Error fetching content hierarchy:', error)
        return []
    }

    return data as Level[]
}
