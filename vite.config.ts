import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import dts from 'vite-plugin-dts'
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
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
      rollupTypes: true,
      tsconfigPath: "./tsconfig.app.json"
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/code/index.ts'),
      name: 'RoAvatar-Renderer',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: []
    },
    minify: false
  }
})
