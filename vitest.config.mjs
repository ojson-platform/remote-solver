import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globalSetup: ['./vitest.global-setup.ts', '@ojson/spec-coverage/setup'],
    reporters: ['default', '@ojson/spec-coverage/reporter'],
  },
});
