import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Handwriting to LaTeX Converter",
  description: "Convert handwritten PDFs to LaTeX with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen flex flex-col bg-pattern`}
      >
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Toaster 
            richColors 
            position="top-center"
            toastOptions={{
              style: {
                background: 'oklch(0.995 0.005 85)',
                border: '1px solid oklch(0.88 0.012 85)',
                color: 'oklch(0.22 0.02 30)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
