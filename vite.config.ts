import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import dts from 'vite-plugin-dts'
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "thirdparty/draco/javascript/draco_decoder.js",
          dest: ""
        }
      ]
    }),
    dts({
      insertTypesEntry: true,
      bundleTypes: true,
      tsconfigPath: "./tsconfig.app.json"
    })
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/code/index.ts'),
      name: 'RoAvatar-Renderer',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: []
    },
    minify: false
  },
  resolve: {
    tsconfigPaths: true
  }
})
