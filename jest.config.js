/**
 * Jest configuration for a Next.js application using TypeScript
 * Uses next/jest to load the Next.js config and proper Babel transform
 */
const nextJest = require('next/jest');

// Provide the path to your Next.js app to load next.config.js and .env files in tests
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  // Run our test suite focusing on SendingMode issues
  testMatch: [
    '<rootDir>/__tests__/useIambicKeyer.test.ts',
    '<rootDir>/__tests__/useIambicKeyer.test.tsx',
    '<rootDir>/__tests__/components/SendingMode.test.tsx'
  ],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/test-utils/jest-setup.js'],
};

// Export the Jest config, wrapping with Next.js presets
module.exports = createJestConfig(customJestConfig);