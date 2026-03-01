import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts', '**/*.test.tsx', '**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@chat/shared$': '<rootDir>/../shared/src',
    '^@chat/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '\\.(less|css)$': '<rootDir>/__tests__/styleMock.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
};

export default config;
