module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  env: {
    node: true,
    es6: true,
    'jest/globals': true,
  },
  plugins: [
    '@typescript-eslint',
    'prettier',
    'import',
    'jest',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  rules: {
    'curly': 2,
    'semi': [2, 'always'],
    'no-console': 2,
    '@typescript-eslint/no-unused-vars': ['off'],
    'quotes': [2, 'single', { 'avoidEscape': true }],
    'typescript-eslint/no-explicit-any': ['off'],
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      },
    ],
    'import/no-unresolved': 'error',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['sibling', 'parent'],
          'index',
          'unknown',
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: false,
        },
      },
    ],
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json'
      }
    }
  }
}