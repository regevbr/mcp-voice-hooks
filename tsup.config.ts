import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/unified-server.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: {
    compilerOptions: {
      allowImportingTsExtensions: true
    }
  },
  splitting: false,
  platform: 'node',
  external: ['@modelcontextprotocol/sdk']
});