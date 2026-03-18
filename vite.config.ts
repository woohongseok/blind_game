import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const isWeb = process.env.BUILD_TARGET === 'web'

export default defineConfig(async () => {
  const plugins = [react()]

  if (!isWeb) {
    const electron = (await import('vite-plugin-electron')).default
    const renderer = (await import('vite-plugin-electron-renderer')).default
    plugins.push(
      electron([
        {
          entry: 'electron/main.ts',
          vite: { build: { outDir: 'dist-electron' } },
        },
        {
          entry: 'electron/preload.ts',
          onstart(args) { args.reload() },
          vite: { build: { outDir: 'dist-electron' } },
        },
      ]),
      renderer(),
    )
  }

  return {
    plugins,
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@game': path.resolve(__dirname, 'src/game'),
      '@entities': path.resolve(__dirname, 'src/entities'),
      '@systems': path.resolve(__dirname, 'src/systems'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@scenes': path.resolve(__dirname, 'src/scenes'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
})
