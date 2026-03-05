'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
    theme: Theme
    toggleTheme: () => void
}>({
    theme: 'light',
    toggleTheme: () => {},
})

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('dash-theme') as Theme | null
        if (saved === 'dark' || saved === 'light') {
            setTheme(saved)
        }
        setMounted(true)
    }, [])

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light'
        setTheme(next)
        localStorage.setItem('dash-theme', next)
    }

    if (!mounted) return null

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            <div data-dash-theme={theme}>
                {children}
            </div>
        </ThemeContext.Provider>
    )
}

export const useDashTheme = () => useContext(ThemeContext)
