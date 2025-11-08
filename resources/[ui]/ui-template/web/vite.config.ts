import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	base: './',
	plugins: [react()],
	build: {
		target: 'es2019',
		outDir: 'dist',
		emptyOutDir: true,
		assetsDir: 'assets'
	},
	server: {
		strictPort: true,
		port: 5173
	}
})


