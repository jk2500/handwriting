import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './apps/web/src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/web/src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Add your theme customizations here
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    // Add any Tailwind plugins here (e.g., require('@tailwindcss/typography'))
  ],
}
export default config