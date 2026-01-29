'use client'

/**
 * Centralized logger utility
 * Suppresses logs in production to keep console clean
 */
export const logger = {
    error: (message: string, data?: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
            console.error(message, data)
        }
    },
    warn: (message: string, data?: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(message, data)
        }
    },
    info: (message: string, data?: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(message, data)
        }
    }
}
