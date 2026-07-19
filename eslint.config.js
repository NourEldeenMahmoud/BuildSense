import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@nx': nx,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          allowCircularSelfDependency: false,
          depConstraints: [
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['type:domain', 'type:contracts', 'type:config'],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:contracts',
                'type:config',
                'type:infrastructure',
                'type:engine',
              ],
            },
            {
              sourceTag: 'scope:worker',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:contracts',
                'type:config',
                'type:infrastructure',
                'type:ingestion',
                'type:engine',
                'type:facts',
              ],
            },
            { sourceTag: 'type:domain', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:contracts', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:config', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:infrastructure', onlyDependOnLibsWithTags: ['type:contracts'] },
            {
              sourceTag: 'type:engine',
              onlyDependOnLibsWithTags: ['type:domain', 'type:contracts'],
            },
            {
              sourceTag: 'type:facts',
              onlyDependOnLibsWithTags: ['type:domain'],
            },
            {
              sourceTag: 'type:test-support',
              onlyDependOnLibsWithTags: ['type:domain', 'type:contracts'],
            },
          ],
          enforceBuildableLibDependency: true,
        },
      ],
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '.nx/'],
  },
);
