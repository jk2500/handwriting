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
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        forcedTheme="light"
    >
        {children}
    </NextThemesProvider>
  )
}
