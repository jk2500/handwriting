'use client'

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

interface ThemeProps {
  children: React.ReactNode;
  defaultTheme?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({ 
  children, 
  ...props 
}: ThemeProps) {
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