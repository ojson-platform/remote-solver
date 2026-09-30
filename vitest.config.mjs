import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['@ojson/spec-coverage/setup'],
    reporters: ['default', '@ojson/spec-coverage/reporter'],
  },
});
