'use client'

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
        {...props}
        attribute="class" // Apply theme class to HTML element
        defaultTheme="system" // Default to system preference
        enableSystem // Enable system preference detection
        // Disable theme switching UI by not providing storageKey or ways to change it
        // disableTransitionOnChange // Optional: prevents style flashing on theme change, might not be needed if no manual toggle
    >
        {children}
    </NextThemesProvider>
  )
} 