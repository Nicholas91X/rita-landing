'use client'

import { useState } from 'react'
import { signOutUser } from '@/app/actions/user'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import TransitionOverlay from '@/components/TransitionOverlay'

export default function AdminLogoutButton() {
    const [loggingOut, setLoggingOut] = useState(false)

    return (
        <>
            <TransitionOverlay show={loggingOut} message="Uscita in corso..." />
            <Button
                onClick={async () => {
                    setLoggingOut(true)
                    await signOutUser()
                }}
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/10 gap-2 px-2 h-8 rounded-lg transition-all"
            >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Esci</span>
            </Button>
        </>
    )
}
