module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  transformIgnorePatterns: ['node_modules/(?!@nestjs/schedule/)'],
  moduleNameMapper: { '^@nestjs/schedule$': '<rootDir>/src/testing/schedule.mock.ts' },
  clearMocks: true,
};
