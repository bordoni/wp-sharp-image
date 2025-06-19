#!/usr/bin/env bun

/**
 * WordPress Sharp Image Processing Setup Script
 * 
 * Automatically detects available process managers (supervisor, systemd, PM2)
 * and configures the service for automatic startup and management.
 * 
 * @since TBD
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { Prompt } from './src/Prompt.js';
import RequirementsChecker from './scripts/check-requirements.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Setup configuration class
 * 
 * @since TBD
 */
class SetupManager {
	/**
	 * Current working directory
	 * 
	 * @since TBD
	 * 
	 * @type {string}
	 */
	workingDir = __dirname;

	/**
	 * Current user information
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	userInfo = {};

	/**
	 * Available process managers
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	processManagers = {};

	/**
	 * Prompt interface
	 * 
	 * @since TBD
	 * 
	 * @type {Prompt}
	 */
	prompt = null;

	/**
	 * Constructor
	 * 
	 * @since TBD
	 */
	constructor() {
		this.userInfo = os.userInfo();
		this.prompt = new Prompt();
		console.log('🛠️  WordPress Sharp Image Processing Setup');
		console.log('=========================================');
	}

	/**
	 * Run the setup process
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async run() {
		try {
			console.log('🔍 Detecting system configuration...');
			
			// Check system requirements first
			const requirementsChecker = new RequirementsChecker();
			const requirementsMet = await requirementsChecker.checkAll();
			
			if (!requirementsMet) {
				const continueAnyway = await this.prompt.confirm(
					'\nSome requirements are not met. Continue with setup anyway?',
					false
				);
				
				if (!continueAnyway) {
					console.log('⏹️  Setup cancelled. Please address the requirements above.');
					return;
				}
			}
			
			// Check prerequisites
			await this.checkPrerequisites();
			
			// Detect available process managers
			await this.detectProcessManagers();
			
			// Create configuration file if it doesn't exist
			await this.ensureConfiguration();
			
			// Show available options and let user choose
			await this.presentOptions();
			
		} catch (error) {
			console.error('❌ Setup failed:', error.message);
			process.exit(1);
		} finally {
			// Always close the prompt interface
			this.prompt.close();
		}
	}

	/**
	 * Check system prerequisites
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkPrerequisites() {
		// Check if Bun is available
		try {
			const { stdout } = await execAsync('bun --version');
			console.log('✅ Bun detected:', stdout.trim());
		} catch (error) {
			throw new Error('Bun is not installed or not in PATH');
		}

		// Check if we can write to common service directories
		const servicePaths = [
			'/etc/supervisor/conf.d',
			'/etc/systemd/system',
			'/lib/systemd/system'
		];

		console.log('📁 Working directory:', this.workingDir);
		console.log('👤 Running as user:', this.userInfo.username);

		// Check write permissions
		for (const servicePath of servicePaths) {
			if (await fs.pathExists(servicePath)) {
				try {
					await fs.access(servicePath, fs.constants.W_OK);
					console.log(`✅ Write access to ${servicePath}`);
				} catch (error) {
					console.log(`⚠️  No write access to ${servicePath} (may need sudo)`);
				}
			}
		}
	}

	/**
	 * Detect available process managers
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async detectProcessManagers() {
		console.log('\n🔍 Detecting available process managers...');

		// Check for Supervisor
		try {
			const { stdout } = await execAsync('supervisorctl version');
			this.processManagers.supervisor = {
				available: true,
				version: stdout.trim(),
				configPath: '/etc/supervisor/conf.d/wp-sharp-image.conf'
			};
			console.log('✅ Supervisor detected:', stdout.trim());
		} catch (error) {
			this.processManagers.supervisor = { available: false };
			console.log('❌ Supervisor not available');
		}

		// Check for systemd
		try {
			const { stdout } = await execAsync('systemctl --version');
			const version = stdout.split('\n')[0];
			this.processManagers.systemd = {
				available: true,
				version: version,
				configPath: '/etc/systemd/system/wp-sharp-image.service'
			};
			console.log('✅ systemd detected:', version);
		} catch (error) {
			this.processManagers.systemd = { available: false };
			console.log('❌ systemd not available');
		}

		// Check for PM2
		try {
			const { stdout } = await execAsync('pm2 --version');
			this.processManagers.pm2 = {
				available: true,
				version: stdout.trim(),
				configPath: path.join(this.workingDir, 'pm2.json')
			};
			console.log('✅ PM2 detected:', stdout.trim());
		} catch (error) {
			this.processManagers.pm2 = { available: false };
			console.log('❌ PM2 not available');
		}

		// Check for Docker (optional)
		try {
			const { stdout } = await execAsync('docker --version');
			this.processManagers.docker = {
				available: true,
				version: stdout.trim()
			};
			console.log('✅ Docker detected:', stdout.trim());
		} catch (error) {
			this.processManagers.docker = { available: false };
			console.log('❌ Docker not available');
		}
	}

	/**
	 * Ensure configuration file exists
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async ensureConfiguration() {
		const configPath = path.join(this.workingDir, 'config.js');
		const exampleConfigPath = path.join(this.workingDir, 'config.example.js');

		if (!await fs.pathExists(configPath)) {
			if (await fs.pathExists(exampleConfigPath)) {
				console.log('\n📋 Creating configuration file...');
				await fs.copy(exampleConfigPath, configPath);
				console.log('✅ Created config.js from config.example.js');
				console.log('⚠️  Please edit config.js with your WordPress installation paths');
			} else {
				throw new Error('config.example.js not found');
			}
		} else {
			console.log('✅ Configuration file already exists');
		}
	}

	/**
	 * Present available options to the user
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async presentOptions() {
		console.log('\n🎯 Available setup options:');
		
		const availableManagers = Object.entries(this.processManagers)
			.filter(([_, manager]) => manager.available);

		if (availableManagers.length === 0) {
			console.log('❌ No supported process managers found');
			console.log('📦 You can install one of the following:');
			console.log('   - Supervisor: apt-get install supervisor (Ubuntu/Debian)');
			console.log('   - systemd: Usually pre-installed on modern Linux systems');
			console.log('   - PM2: npm install -g pm2');
			
			const installChoice = await this.prompt.confirm('\nWould you like to see manual installation instructions?', true);
			if (installChoice) {
				this.showManualInstructions();
			}
			return;
		}

		// Create options array
		const options = [
			...availableManagers.map(([name, manager]) => `${name.toUpperCase()}: ${manager.version}`),
			'Manual setup (show commands)',
			'Skip service setup'
		];

		const selectedIndex = await this.prompt.select(
			'\nSelect a process manager to configure:',
			options,
			0
		);

		if (selectedIndex < availableManagers.length) {
			// User selected a process manager
			const choice = availableManagers[selectedIndex];
			const confirmSetup = await this.prompt.confirm(
				`\nConfigure ${choice[0].toUpperCase()} service? This may require sudo access.`,
				true
			);

			if (confirmSetup) {
				await this.configureService(choice[0], choice[1]);
			} else {
				console.log('⏭️  Skipping automatic setup.');
				this.showManualInstructions();
			}

		} else if (selectedIndex === availableManagers.length) {
			// Manual setup
			this.showManualInstructions();

		} else {
			// Skip setup
			console.log('⏭️  Service setup skipped.');
			console.log('ℹ️  You can run this script again later to configure the service.');
		}
	}

	/**
	 * Configure the selected service
	 * 
	 * @since TBD
	 * 
	 * @param {string} serviceName Name of the service to configure.
	 * @param {Object} serviceInfo Service information object.
	 * 
	 * @return {Promise<void>}
	 */
	async configureService(serviceName, serviceInfo) {
		console.log(`\n⚙️  Configuring ${serviceName.toUpperCase()}...`);

		switch (serviceName) {
			case 'supervisor':
				await this.configureSupervisor(serviceInfo);
				break;
			case 'systemd':
				await this.configureSystemd(serviceInfo);
				break;
			case 'pm2':
				await this.configurePM2(serviceInfo);
				break;
			default:
				console.log(`❌ Unknown service: ${serviceName}`);
		}
	}

	/**
	 * Configure Supervisor service
	 * 
	 * @since TBD
	 * 
	 * @param {Object} serviceInfo Service information.
	 * 
	 * @return {Promise<void>}
	 */
	async configureSupervisor(serviceInfo) {
		try {
			// Read the template
			const templatePath = path.join(this.workingDir, 'supervisor', 'supervisor.conf');
			let configContent = await fs.readFile(templatePath, 'utf8');

			// Replace placeholders with actual paths
			const user = this.userInfo.username === 'root' ? 'www-data' : this.userInfo.username;
			configContent = configContent
				.replace(/{{WORKING_DIRECTORY}}/g, this.workingDir)
				.replace(/{{SERVICE_USER}}/g, user);

			// Write the configuration
			console.log('📝 Writing supervisor configuration...');
			await fs.writeFile(serviceInfo.configPath, configContent);
			console.log(`✅ Configuration written to ${serviceInfo.configPath}`);

			// Reload supervisor
			console.log('🔄 Reloading supervisor...');
			await execAsync('sudo supervisorctl reread');
			await execAsync('sudo supervisorctl update');
			
			console.log('🚀 Starting wp-sharp-image service...');
			await execAsync('sudo supervisorctl start wp-sharp-image');
			
			console.log('✅ Supervisor setup complete!');
			console.log('\n📊 Monitor the service with:');
			console.log('   sudo supervisorctl status wp-sharp-image');
			console.log('   sudo supervisorctl tail -f wp-sharp-image');

		} catch (error) {
			console.error('❌ Supervisor setup failed:', error.message);
			console.log('\n🔧 Manual setup instructions:');
			console.log(`1. Copy supervisor/supervisor.conf to ${serviceInfo.configPath}`);
			console.log('2. Update paths in the configuration file');
			console.log('3. Run: sudo supervisorctl reread && sudo supervisorctl update');
			console.log('4. Start: sudo supervisorctl start wp-sharp-image');
		}
	}

	/**
	 * Configure systemd service
	 * 
	 * @since TBD
	 * 
	 * @param {Object} serviceInfo Service information.
	 * 
	 * @return {Promise<void>}
	 */
	async configureSystemd(serviceInfo) {
		try {
			// Read the template
			const templatePath = path.join(this.workingDir, 'supervisor', 'systemd.service');
			let configContent = await fs.readFile(templatePath, 'utf8');

			// Replace placeholders with actual paths
			const user = this.userInfo.username === 'root' ? 'www-data' : this.userInfo.username;
			const uploadsPath = path.resolve(this.workingDir, '../../wp-content/uploads');
			
			configContent = configContent
				.replace(/{{WORKING_DIRECTORY}}/g, this.workingDir)
				.replace(/{{UPLOADS_DIRECTORY}}/g, uploadsPath)
				.replace(/{{SERVICE_USER}}/g, user)
				.replace(/{{SERVICE_GROUP}}/g, user);

			// Write the configuration
			console.log('📝 Writing systemd service file...');
			await fs.writeFile(serviceInfo.configPath, configContent);
			console.log(`✅ Service file written to ${serviceInfo.configPath}`);

			// Enable and start the service
			console.log('🔄 Enabling systemd service...');
			await execAsync('sudo systemctl daemon-reload');
			await execAsync('sudo systemctl enable wp-sharp-image');
			
			console.log('🚀 Starting wp-sharp-image service...');
			await execAsync('sudo systemctl start wp-sharp-image');
			
			console.log('✅ systemd setup complete!');
			console.log('\n📊 Monitor the service with:');
			console.log('   sudo systemctl status wp-sharp-image');
			console.log('   sudo journalctl -u wp-sharp-image -f');

		} catch (error) {
			console.error('❌ systemd setup failed:', error.message);
			console.log('\n🔧 Manual setup instructions:');
			console.log(`1. Copy supervisor/systemd.service to ${serviceInfo.configPath}`);
			console.log('2. Update paths in the service file');
			console.log('3. Run: sudo systemctl daemon-reload');
			console.log('4. Enable: sudo systemctl enable wp-sharp-image');
			console.log('5. Start: sudo systemctl start wp-sharp-image');
		}
	}

	/**
	 * Configure PM2 service
	 * 
	 * @since TBD
	 * 
	 * @param {Object} serviceInfo Service information.
	 * 
	 * @return {Promise<void>}
	 */
	async configurePM2(serviceInfo) {
		try {
			// Read the template
			const templatePath = path.join(this.workingDir, 'supervisor', 'pm2.config.cjs');
			let configContent = await fs.readFile(templatePath, 'utf8');

			// Replace placeholders with actual paths
			configContent = configContent.replace(/{{WORKING_DIRECTORY}}/g, this.workingDir);

			// Write the configuration as .cjs file
			const configPath = path.join(this.workingDir, 'ecosystem.config.cjs');
			console.log('📝 Writing PM2 configuration...');
			await fs.writeFile(configPath, configContent);
			console.log(`✅ Configuration written to ${configPath}`);

			// Start the service with PM2
			console.log('🚀 Starting wp-sharp-image with PM2...');
			await execAsync(`pm2 start ${configPath} --env production`);
			
			console.log('💾 Saving PM2 configuration...');
			await execAsync('pm2 save');
			
			console.log('⚡ Setting up PM2 startup script...');
			const { stdout } = await execAsync('pm2 startup');
			console.log('ℹ️  PM2 startup command:', stdout);
			
			console.log('✅ PM2 setup complete!');
			console.log('\n📊 Monitor the service with:');
			console.log('   pm2 status');
			console.log('   pm2 logs wp-sharp-image');
			console.log('   pm2 monit');

		} catch (error) {
			console.error('❌ PM2 setup failed:', error.message);
			console.log('\n🔧 Manual setup instructions:');
			console.log('1. Copy supervisor/pm2.config.cjs to ecosystem.config.cjs');
			console.log('2. Update paths in the configuration file');
			console.log('3. Run: pm2 start ecosystem.config.cjs --env production');
			console.log('4. Save: pm2 save');
			console.log('5. Startup: pm2 startup');
		}
	}

	/**
	 * Show manual setup instructions
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	showManualInstructions() {
		console.log('\n📖 Manual Setup Instructions');
		console.log('============================');
		
		console.log('\n1. Configuration:');
		console.log('   cp config.example.js config.js');
		console.log('   # Edit config.js with your settings');
		
		console.log('\n2. Test the application:');
		console.log('   bun run start');
		
		console.log('\n3. Choose a process manager:');
		
		if (this.processManagers.supervisor.available) {
			console.log('\n   Supervisor:');
			console.log('   sudo cp supervisor/supervisor.conf /etc/supervisor/conf.d/wp-sharp-image.conf');
			console.log('   sudo supervisorctl reread && sudo supervisorctl update');
			console.log('   sudo supervisorctl start wp-sharp-image');
		}
		
		if (this.processManagers.systemd.available) {
			console.log('\n   systemd:');
			console.log('   sudo cp supervisor/systemd.service /etc/systemd/system/wp-sharp-image.service');
			console.log('   sudo systemctl daemon-reload');
			console.log('   sudo systemctl enable wp-sharp-image');
			console.log('   sudo systemctl start wp-sharp-image');
		}
		
		if (this.processManagers.pm2.available) {
			console.log('\n   PM2:');
			console.log('   cp supervisor/pm2.config.cjs ecosystem.config.cjs');
			console.log('   pm2 start ecosystem.config.cjs --env production');
			console.log('   pm2 save && pm2 startup');
		}
	}
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const setup = new SetupManager();
	setup.run().catch((error) => {
		console.error('Setup failed:', error);
		process.exit(1);
	});
}

export default SetupManager; 