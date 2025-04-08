import { defineConfig } from 'vite';
import path from 'path';
import { builtinModules } from 'module';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    extensions: ['.ts', '.js', '.json']
  },
  build: {
    ssr: true,
    lib: {
      entry: path.resolve(__dirname, 'src/ts/index.ts'),
      formats: ['cjs']
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        /^build\//,
        path.resolve(__dirname, 'build/Release/dolphin_memory.node')
      ],
      output: {
        dir: 'dist',
        format: 'cjs'
      }
    }
  }
});
