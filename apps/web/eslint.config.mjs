import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['e2e/**/*.ts', 'e2e-visual/**/*.ts'],
    ...playwright.configs['flat/recommended'],
  },
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
];
