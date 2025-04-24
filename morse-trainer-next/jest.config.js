// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Ignore test files in node_modules
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  // The directory where Jest should output its coverage files
  coverageDirectory: '<rootDir>/coverage',
  // If a test path matches any of the patterns, it will be skipped
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
  // The test environment that will be used for testing
  testEnvironment: 'jest-environment-jsdom',
  // Custom module name mapper for CSS modules
  moduleNameMapper: {
    // Handle CSS imports (with CSS modules)
    // https://jestjs.io/docs/webpack#mocking-css-modules
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    // Handle CSS imports (without CSS modules)
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
    // Handle image imports
    '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // Define which test file extensions Jest should run
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);