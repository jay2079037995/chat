import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@chat/shared$': '<rootDir>/../shared/src',
    '^@chat/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^uuid$': '<rootDir>/__tests__/__mocks__/uuid.ts',
  },
};

export default config;
