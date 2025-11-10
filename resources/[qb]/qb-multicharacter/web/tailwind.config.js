/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	darkMode: ['class'],
	theme: {
		extend: {
			colors: {
				border: '#2a2a2a',
				input: '#2a2a2a',
				ring: '#2a2a2a',
				background: '#1a1a1a',
				foreground: '#ffffff',
				primary: {
					DEFAULT: '#ffffff',
					foreground: '#1a1a1a'
				},
				secondary: {
					DEFAULT: '#0f0f0f',
					foreground: '#ffffff'
				},
				destructive: {
					DEFAULT: '#ef4444',
					foreground: '#ffffff'
				},
				muted: {
					DEFAULT: '#151515',
					foreground: '#888888'
				},
				accent: {
					DEFAULT: '#151515',
					foreground: '#ffffff'
				},
				success: {
					DEFAULT: '#22c55e',
					hover: '#16a34a'
				},
				error: {
					DEFAULT: '#ef4444',
					hover: '#dc2626'
				}
			},
			borderRadius: {
				lg: '8px',
				md: '6px',
				sm: '4px'
			}
		}
	},
	plugins: [],
}

