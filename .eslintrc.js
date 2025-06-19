#!/usr/bin/env bun

/**
 * ESLint Configuration for WordPress Sharp Image Processing
 * 
 * @since TBD
 */

module.exports = {
	env: {
		bun: true,
		node: true,
		es2022: true
	},
	extends: [
		'eslint:recommended'
	],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module'
	},
	rules: {
		// WordPress-like indentation and formatting
		'indent': ['error', 'tab'],
		'quotes': ['error', 'single'],
		'semi': ['error', 'always'],
		'comma-dangle': ['error', 'never'],
		'no-trailing-spaces': 'error',
		'eol-last': 'error',

		// Code quality
		'no-console': 'warn',
		'no-debugger': 'error',
		'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		'no-var': 'error',
		'prefer-const': 'error',
		'prefer-arrow-callback': 'error',
		'arrow-spacing': 'error',

		// Object and array formatting
		'object-curly-spacing': ['error', 'always'],
		'array-bracket-spacing': ['error', 'never'],
		'computed-property-spacing': ['error', 'never'],

		// Function formatting
		'space-before-function-paren': ['error', {
			anonymous: 'never',
			named: 'never',
			asyncArrow: 'always'
		}],
		'function-paren-newline': ['error', 'multiline-arguments'],

		// Control flow
		'brace-style': ['error', '1tbs', { allowSingleLine: true }],
		'keyword-spacing': 'error',
		'space-before-blocks': 'error',

		// Best practices
		'camelcase': ['error', { properties: 'never' }],
		'dot-notation': 'error',
		'eqeqeq': ['error', 'always'],
		'no-eval': 'error',
		'no-implied-eval': 'error',
		'no-new-func': 'error',
		'no-throw-literal': 'error',
		'radix': 'error',

		// JSDoc requirements
		'valid-jsdoc': ['error', {
			prefer: {
				returns: 'return'
			},
			requireReturn: false,
			requireParamDescription: true,
			requireReturnDescription: true
		}],
		'require-jsdoc': ['error', {
			require: {
				FunctionDeclaration: true,
				MethodDefinition: true,
				ClassDeclaration: true,
				ArrowFunctionExpression: false,
				FunctionExpression: false
			}
		}]
	},
	globals: {
		// Bun globals
		Bun: 'readonly'
	}
}; 