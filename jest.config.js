module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'agent-core/**/*.js',
    'src/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**'
  ],
};
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  collectCoverage: false,
  verbose: false,
  // Avoid leaking open handles
  forceExit: true,
};
};