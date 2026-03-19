import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  clearScreen: false,
  build: {
    target: 'esnext',
    minify: false,
  },
})
