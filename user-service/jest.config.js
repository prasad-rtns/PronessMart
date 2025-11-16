module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    'helpers/**/*.js',
    'middlewares/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/config/**',
    '!src/server.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 40,
      lines: 50,
      statements: 50
    }
  },
  setupFiles: ['<rootDir>/tests/setup/envTestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setup.js'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  testTimeout: 10000,
  verbose: true
};