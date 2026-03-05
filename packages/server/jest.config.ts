import type { Config } from 'jest';

// 测试使用 Redis db 1，避免 flushdb 清除开发数据（db 0）
process.env.REDIS_DB = '1';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@chat/shared$': '<rootDir>/../shared/src',
    '^@chat/shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^uuid$': '<rootDir>/__tests__/__mocks__/uuid.ts',
    '^@mastra/core/agent$': '<rootDir>/__tests__/__mocks__/@mastra/core/agent.ts',
    '^@mastra/core/tools$': '<rootDir>/__tests__/__mocks__/@mastra/core/tools.ts',
  },
};

export default config;
