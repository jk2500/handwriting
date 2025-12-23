'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'oklch(0.985 0.008 85)' }}>
        <div 
          className="rounded-xl p-8 max-w-md w-full text-center mx-4 shadow-sm"
          style={{ 
            backgroundColor: 'oklch(0.95 0.02 25 / 0.3)',
            border: '1px solid oklch(0.55 0.22 25 / 0.2)'
          }}
        >
          <div 
            className="mx-auto mb-4 h-14 w-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'oklch(0.55 0.22 25 / 0.1)' }}
          >
            <AlertTriangle className="h-7 w-7" style={{ color: 'oklch(0.55 0.22 25)' }} />
          </div>
          <h2 
            className="text-xl font-semibold mb-2"
            style={{ color: 'oklch(0.22 0.02 30)' }}
          >
            Application Error
          </h2>
          <p 
            className="mb-4 text-sm"
            style={{ color: 'oklch(0.50 0.015 30)' }}
          >
            {error.message || 'A critical error occurred'}
          </p>
          {error.digest && (
            <p 
              className="text-xs mb-4 font-mono"
              style={{ color: 'oklch(0.50 0.015 30 / 0.7)' }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'oklch(0.40 0.12 195)',
              color: 'white'
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
