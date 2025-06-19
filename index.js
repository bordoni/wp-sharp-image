#!/usr/bin/env bun

/**
 * WordPress Sharp Image Processing Service
 * 
 * High-performance image processing for WordPress using Sharp and Bun.
 * Monitors the WordPress uploads directory and automatically processes
 * new images according to WordPress image size configurations.
 * 
 * @since TBD
 */

import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { Database } from './src/Database.js';
import { ImageProcessor } from './src/ImageProcessor.js';
import { FileWatcher } from './src/FileWatcher.js';
import { logger, configureLogger, logStats } from './src/Logger.js';

// ES6 __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WordPress Sharp Image Processing Application
 * 
 * @since TBD
 */
class WordPressSharpImageApp {
	/**
	 * Application configuration
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	config = null;

	/**
	 * Database instance
	 * 
	 * @since TBD
	 * 
	 * @type {Database}
	 */
	database = null;

	/**
	 * Image processor instance
	 * 
	 * @since TBD
	 * 
	 * @type {ImageProcessor}
	 */
	imageProcessor = null;

	/**
	 * File watcher instance
	 * 
	 * @since TBD
	 * 
	 * @type {FileWatcher}
	 */
	fileWatcher = null;

	/**
	 * Application statistics
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	stats = {
		startTime: Date.now(),
		lastImageSizeUpdate: null,
		totalProcessed: 0,
		errors: 0
	};

	/**
	 * Monitoring interval
	 * 
	 * @since TBD
	 * 
	 * @type {NodeJS.Timeout}
	 */
	monitoringInterval = null;

	/**
	 * Application initialization
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async initialize() {
		try {
			console.log('🚀 WordPress Sharp Image Processing Service');
			console.log('==========================================');

			// Load configuration
			await this.loadConfiguration();

			// Configure logging
			configureLogger(this.config.logging);

			logger.info('Starting WordPress Sharp Image Processing Service');

			// Initialize components
			await this.initializeDatabase();
			await this.initializeImageProcessor();
			await this.initializeFileWatcher();

			// Setup monitoring
			this.setupMonitoring();

			// Setup graceful shutdown
			this.setupGracefulShutdown();

			logger.info('Application initialized successfully');

		} catch (error) {
			console.error('❌ Failed to initialize application:', error.message);
			process.exit(1);
		}
	}

	/**
	 * Load application configuration
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async loadConfiguration() {
		const configPath = path.join(__dirname, 'config.js');
		const exampleConfigPath = path.join(__dirname, 'config.example.js');

		try {
			// Check if config file exists
			if (!await fs.pathExists(configPath)) {
				if (await fs.pathExists(exampleConfigPath)) {
					logger.warn('Config file not found. Please copy config.example.js to config.js and configure it.');
					console.log('📋 Copy config.example.js to config.js and configure it:');
					console.log(`   cp ${exampleConfigPath} ${configPath}`);
				} else {
					throw new Error('No configuration file found');
				}
				process.exit(1);
			}

			// Load configuration
			const configModule = await import(configPath);
			this.config = configModule.default;

			// Validate configuration
			this.validateConfiguration();

			logger.info('Configuration loaded successfully');

		} catch (error) {
			throw new Error(`Failed to load configuration: ${error.message}`);
		}
	}

	/**
	 * Validate application configuration
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	validateConfiguration() {
		const required = [
			'wordpress.rootPath',
			'wordpress.uploadsPath'
		];

		for (const key of required) {
			const value = key.split('.').reduce((obj, k) => obj?.[k], this.config);
			if (!value) {
				throw new Error(`Missing required configuration: ${key}`);
			}
		}

		// Validate paths
		if (!fs.existsSync(this.config.wordpress.uploadsPath)) {
			throw new Error(`Uploads path does not exist: ${this.config.wordpress.uploadsPath}`);
		}

		if (!fs.existsSync(this.config.wordpress.rootPath)) {
			throw new Error(`WordPress root path does not exist: ${this.config.wordpress.rootPath}`);
		}
	}

	/**
	 * Initialize WordPress data access via wp-cli
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async initializeDatabase() {
		logger.info('Initializing WordPress data access via wp-cli...');

		this.database = new Database(this.config);
		
		const connected = await this.database.connect();
		if (!connected) {
			throw new Error('Failed to connect to WordPress via wp-cli. Make sure wp-cli is installed and WordPress path is correct.');
		}

		logger.info('WordPress data access established');
	}

	/**
	 * Initialize image processor
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async initializeImageProcessor() {
		logger.info('Initializing image processor...');

		// Get WordPress image sizes from database
		const imageSizes = await this.database.getImageSizes();
		this.stats.lastImageSizeUpdate = Date.now();

		// Create image processor
		this.imageProcessor = new ImageProcessor(this.config.images, imageSizes);

		logger.info('Image processor initialized');
	}

	/**
	 * Initialize file watcher
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async initializeFileWatcher() {
		logger.info('Initializing file watcher...');

		// Create file watcher with callback
		this.fileWatcher = new FileWatcher(
			this.config.watcher,
			this.handleNewImage.bind(this)
		);

		// Start watching uploads directory
		await this.fileWatcher.startWatching(this.config.wordpress.uploadsPath);

		logger.info('File watcher initialized');
	}

	/**
	 * Handle new image file detected by watcher
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath Path to the new image file.
	 * 
	 * @return {Promise<void>}
	 */
	async handleNewImage(filePath) {
		try {
			// Process the image
			const metadata = await this.imageProcessor.processImage(filePath);
			

			logger.info('handleNewImage', metadata);
			if (metadata) {
				// Get attachment ID from database
				const relativePath = path.relative(this.config.wordpress.uploadsPath, filePath);
				const attachmentId = await this.database.getAttachmentIdByPath(relativePath);

				if (attachmentId) {
					// Update attachment metadata in database
					await this.database.updateAttachmentMeta(attachmentId, metadata);
					logger.info(`Updated attachment metadata for ID: ${attachmentId}`);
				} else {
					logger.warn(`No attachment found for file: ${path.basename(filePath)}`);
				}

				this.stats.totalProcessed++;
			}

		} catch (error) {
			this.stats.errors++;
			logger.error(`Failed to handle new image: ${path.basename(filePath)}`, {
				error: error.message,
				path: filePath
			});
		}
	}

	/**
	 * Setup monitoring and statistics reporting
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	setupMonitoring() {
		if (!this.config.monitoring.enabled) {
			return;
		}

		const interval = this.config.monitoring.reportInterval * 60 * 1000; // Convert to milliseconds

		this.monitoringInterval = setInterval(() => {
			this.reportStatistics();
		}, interval);

		logger.info(`Monitoring enabled, reporting every ${this.config.monitoring.reportInterval} minutes`);
	}

	/**
	 * Report system statistics
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	reportStatistics() {
		const appUptime = Date.now() - this.stats.startTime;
		const processorStats = this.imageProcessor.getStats();
		const watcherStats = this.fileWatcher.getStats();

		const stats = {
			uptime: this.formatUptime(appUptime),
			totalProcessed: this.stats.totalProcessed,
			errors: this.stats.errors,
			processor: processorStats,
			watcher: watcherStats,
			memory: process.memoryUsage(),
			lastImageSizeUpdate: this.stats.lastImageSizeUpdate ? 
				new Date(this.stats.lastImageSizeUpdate).toISOString() : 'Never'
		};

		logStats(stats);
	}

	/**
	 * Format uptime in human readable format
	 * 
	 * @since TBD
	 * 
	 * @param {number} uptime Uptime in milliseconds.
	 * 
	 * @return {string} Formatted uptime string.
	 */
	formatUptime(uptime) {
		const seconds = Math.floor(uptime / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h ${minutes % 60}m`;
		} else if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	/**
	 * Refresh image sizes from database
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async refreshImageSizes() {
		try {
			logger.info('Refreshing image sizes from database...');
			
			const imageSizes = await this.database.getImageSizes();
			this.imageProcessor.updateImageSizes(imageSizes);
			this.stats.lastImageSizeUpdate = Date.now();
			
			logger.info('Image sizes refreshed successfully');

		} catch (error) {
			logger.error('Failed to refresh image sizes:', error.message);
		}
	}

	/**
	 * Setup graceful shutdown handlers
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	setupGracefulShutdown() {
		const shutdownHandler = async (signal) => {
			logger.info(`Received ${signal}, shutting down gracefully...`);
			await this.shutdown();
			process.exit(0);
		};

		process.on('SIGINT', shutdownHandler);
		process.on('SIGTERM', shutdownHandler);
		process.on('SIGQUIT', shutdownHandler);

		// Handle uncaught exceptions
		process.on('uncaughtException', (error) => {
			logger.error('Uncaught exception:', error);
			this.shutdown().then(() => process.exit(1));
		});

		process.on('unhandledRejection', (reason, promise) => {
			logger.error('Unhandled rejection at:', promise, 'reason:', reason);
			this.shutdown().then(() => process.exit(1));
		});
	}

	/**
	 * Shutdown the application gracefully
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async shutdown() {
		logger.info('Shutting down application...');

		// Clear monitoring interval
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
		}

		// Stop file watcher
		if (this.fileWatcher) {
			await this.fileWatcher.stopWatching();
		}

		// Close WordPress data access
		if (this.database) {
			await this.database.disconnect();
		}

		// Report final statistics
		this.reportStatistics();

		logger.info('Application shutdown complete');
	}

	/**
	 * Start the application
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async start() {
		await this.initialize();
		
		logger.info('🎉 WordPress Sharp Image Processing Service is running!');
		console.log('🎉 WordPress Sharp Image Processing Service is running!');
		console.log('📁 Monitoring:', this.config.wordpress.uploadsPath);
		console.log('📊 Monitoring enabled:', this.config.monitoring.enabled);
		console.log('🛑 Press Ctrl+C to stop');
		
		// Keep the process running
		process.stdin.resume();
	}
}

// Start the application if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const app = new WordPressSharpImageApp();
	app.start().catch((error) => {
		console.error('❌ Application startup failed:', error);
		process.exit(1);
	});
}

export default WordPressSharpImageApp; 