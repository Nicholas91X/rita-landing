'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DashboardThemeProvider } from './ThemeContext'
import { EmailVerificationBanner } from '@/components/auth/EmailVerificationBanner'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import { NotificationSoftPrompt } from '@/components/push/NotificationSoftPrompt'
import { IosInstallDialog } from '@/components/push/IosInstallDialog'
import { usePushPromptOrchestrator } from '@/hooks/usePushPromptOrchestrator'
import { useHeartbeat } from '@/hooks/useHeartbeat'

interface DashboardShellProps {
    children: ReactNode
    enablePushPrompts?: boolean
}

/**
 * Outer chrome shared by every dashboard variant.
 * Each variant (Standard / Lead) renders its own sidebar + main inside `children`.
 */
export default function DashboardShell({
    children,
    enablePushPrompts = true,
}: DashboardShellProps) {
    const [bannerVisible, setBannerVisible] = useState(false)
    const { prompt, dismiss, acceptedSoftPrompt } = usePushPromptOrchestrator(enablePushPrompts)
    useHeartbeat(enablePushPrompts)

    return (
        <DashboardThemeProvider>
            <>
                <EmailVerificationBanner onVisibilityChange={setBannerVisible} />
                <div
                    className={cn(
                        'flex min-h-screen bg-[var(--dash-bg)] text-[var(--dash-text)] selection:bg-brand/30 relative overflow-x-hidden transition-colors duration-300',
                        bannerVisible && 'pt-12',
                    )}
                >
                    {children}
                </div>

                <PWAInstallPrompt />
                <NotificationSoftPrompt
                    open={prompt === 'soft'}
                    onDismiss={dismiss}
                    onAccepted={acceptedSoftPrompt}
                />
                <IosInstallDialog open={prompt === 'ios-install'} onDismiss={dismiss} />
            </>
        </DashboardThemeProvider>
    )
}
