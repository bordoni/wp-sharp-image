#!/usr/bin/env bun

/**
 * System Requirements Checker for WordPress Sharp Image Processing
 * 
 * Checks if the system meets all requirements for running the service.
 * 
 * @since TBD
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Requirements checker class
 * 
 * @since TBD
 */
class RequirementsChecker {
	/**
	 * Check results
	 * 
	 * @since TBD
	 * 
	 * @type {Array}
	 */
	results = [];

	/**
	 * Run all requirement checks
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if all requirements are met.
	 */
	async checkAll() {
		console.log('🔍 Checking system requirements...\n');

		await this.checkBun();
		await this.checkNodeVersion();
		await this.checkMemory();
		await this.checkDiskSpace();
		await this.checkImageLibraries();
		await this.checkFilePermissions();
		await this.checkDatabase();

		this.printResults();
		
		const failed = this.results.filter(r => !r.passed);
		return failed.length === 0;
	}

	/**
	 * Check if Bun is available and compatible
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkBun() {
		try {
			const { stdout } = await execAsync('bun --version');
			const version = stdout.trim();
			const versionNumber = parseFloat(version);
			
			if (versionNumber >= 1.0) {
				this.addResult('Bun Runtime', true, `Version ${version}`);
			} else {
				this.addResult('Bun Runtime', false, `Version ${version} (requires >= 1.0.0)`);
			}
		} catch (error) {
			this.addResult('Bun Runtime', false, 'Not found - please install Bun');
		}
	}

	/**
	 * Check Node.js version compatibility
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkNodeVersion() {
		try {
			const { stdout } = await execAsync('node --version');
			const version = stdout.trim();
			const versionNumber = parseFloat(version.substring(1));
			
			if (versionNumber >= 18.17) {
				this.addResult('Node.js Version', true, `Version ${version}`);
			} else {
				this.addResult('Node.js Version', false, `Version ${version} (requires >= 18.17.0)`);
			}
		} catch (error) {
			this.addResult('Node.js Version', false, 'Not found');
		}
	}

	/**
	 * Check available memory
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkMemory() {
		const totalMemory = os.totalmem();
		const totalMemoryGB = (totalMemory / (1024 * 1024 * 1024)).toFixed(1);
		
		if (totalMemory >= 2 * 1024 * 1024 * 1024) { // 2GB
			this.addResult('System Memory', true, `${totalMemoryGB} GB available`);
		} else {
			this.addResult('System Memory', false, `${totalMemoryGB} GB (recommended: >= 2GB)`);
		}
	}

	/**
	 * Check available disk space
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkDiskSpace() {
		try {
			const { stdout } = await execAsync('df -h .');
			const lines = stdout.trim().split('\n');
			const diskInfo = lines[1].split(/\s+/);
			const available = diskInfo[3];
			
			this.addResult('Disk Space', true, `${available} available`);
		} catch (error) {
			this.addResult('Disk Space', false, 'Cannot determine disk space');
		}
	}

	/**
	 * Check for required image processing libraries
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkImageLibraries() {
		// Check for libvips (used by Sharp)
		try {
			const { stdout } = await execAsync('pkg-config --modversion vips');
			this.addResult('libvips', true, `Version ${stdout.trim()}`);
		} catch (error) {
			this.addResult('libvips', false, 'Not found - may be installed via Sharp');
		}
	}

	/**
	 * Check file permissions for WordPress directories
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkFilePermissions() {
		const testPaths = [
			'../../wp-content/uploads',
			'./logs'
		];

		for (const testPath of testPaths) {
			const fullPath = path.resolve(testPath);
			
			try {
				await fs.ensureDir(fullPath);
				await fs.access(fullPath, fs.constants.R_OK | fs.constants.W_OK);
				this.addResult(`Write access to ${path.basename(fullPath)}`, true, 'Accessible');
			} catch (error) {
				this.addResult(`Write access to ${path.basename(fullPath)}`, false, 'No write access');
			}
		}
	}

	/**
	 * Check database connectivity
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkDatabase() {
		// Check if MySQL/MariaDB client is available
		try {
			const { stdout } = await execAsync('mysql --version');
			this.addResult('MySQL Client', true, 'Available');
		} catch (error) {
			this.addResult('MySQL Client', false, 'Not found - database access may still work');
		}
	}

	/**
	 * Add a check result
	 * 
	 * @since TBD
	 * 
	 * @param {string}  name    Check name.
	 * @param {boolean} passed  Whether the check passed.
	 * @param {string}  details Additional details.
	 * 
	 * @return {void}
	 */
	addResult(name, passed, details) {
		this.results.push({ name, passed, details });
	}

	/**
	 * Print all check results
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	printResults() {
		console.log('\n📋 Requirements Check Results:');
		console.log('================================');

		for (const result of this.results) {
			const status = result.passed ? '✅' : '❌';
			console.log(`${status} ${result.name}: ${result.details}`);
		}

		const passed = this.results.filter(r => r.passed).length;
		const total = this.results.length;
		const failed = total - passed;

		console.log(`\n📊 Results: ${passed}/${total} checks passed`);

		if (failed > 0) {
			console.log(`\n⚠️  ${failed} requirement(s) not met. The service may still work but performance could be affected.`);
		} else {
			console.log('\n🎉 All requirements met! Your system is ready for high-performance image processing.');
		}
	}
}

// Run checks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const checker = new RequirementsChecker();
	checker.checkAll().then((allPassed) => {
		process.exit(allPassed ? 0 : 1);
	});
}

export default RequirementsChecker; 