import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/unified-server.ts'],
  format: ['esm'],
  target: 'esnext',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: {
    compilerOptions: {
      allowImportingTsExtensions: true
    }
  },
  external: ['@modelcontextprotocol/sdk']
});