#!/usr/bin/env bun

/**
 * Simple prompt utility for user input
 * 
 * @since TBD
 */

import { createInterface } from 'readline';

/**
 * Simple prompt class for console interaction
 * 
 * @since TBD
 */
export class Prompt {
	/**
	 * Readline interface
	 * 
	 * @since TBD
	 * 
	 * @type {readline.Interface}
	 */
	rl = null;

	/**
	 * Constructor
	 * 
	 * @since TBD
	 */
	constructor() {
		this.rl = createInterface({
			input: process.stdin,
			output: process.stdout
		});
	}

	/**
	 * Ask a question and wait for user input
	 * 
	 * @since TBD
	 * 
	 * @param {string} question The question to ask.
	 * 
	 * @return {Promise<string>} User's answer.
	 */
	async ask(question) {
		return new Promise((resolve) => {
			this.rl.question(question, (answer) => {
				resolve(answer.trim());
			});
		});
	}

	/**
	 * Ask user to select from multiple options
	 * 
	 * @since TBD
	 * 
	 * @param {string} question  The question to ask.
	 * @param {Array}  options   Array of options.
	 * @param {number} defaultOption Default option index (0-based).
	 * 
	 * @return {Promise<number>} Selected option index.
	 */
	async select(question, options, defaultOption = 0) {
		console.log(question);
		
		options.forEach((option, index) => {
			const marker = index === defaultOption ? ' (default)' : '';
			console.log(`${index + 1}. ${option}${marker}`);
		});

		const answer = await this.ask(`\nSelect option [1-${options.length}] (default: ${defaultOption + 1}): `);
		
		if (answer === '') {
			return defaultOption;
		}

		const selectedIndex = parseInt(answer) - 1;
		
		if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= options.length) {
			console.log('Invalid selection, using default option.');
			return defaultOption;
		}

		return selectedIndex;
	}

	/**
	 * Ask for confirmation (y/n)
	 * 
	 * @since TBD
	 * 
	 * @param {string}  question     The question to ask.
	 * @param {boolean} defaultValue Default value if user just presses enter.
	 * 
	 * @return {Promise<boolean>} True if confirmed.
	 */
	async confirm(question, defaultValue = false) {
		const defaultText = defaultValue ? ' (Y/n)' : ' (y/N)';
		const answer = await this.ask(question + defaultText + ': ');
		
		if (answer === '') {
			return defaultValue;
		}

		return answer.toLowerCase().startsWith('y');
	}

	/**
	 * Close the readline interface
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	close() {
		if (this.rl) {
			this.rl.close();
		}
	}
} 