module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  collectCoverage: false,
  verbose: false,
  // Avoid leaking open handles
  forceExit: true,
};
};