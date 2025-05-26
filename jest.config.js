module.exports = {
  clearMocks: true,
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
