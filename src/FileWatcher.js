#!/usr/bin/env bun

/**
 * File Watcher for WordPress uploads directory
 * 
 * Monitors the WordPress uploads directory for new image files
 * and triggers image processing when new files are detected.
 * 
 * @since TBD
 */

import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs-extra';
import { logger } from './Logger.js';

/**
 * File Watcher class
 * 
 * @since TBD
 */
export class FileWatcher {
	/**
	 * Watcher configuration
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	config = null;

	/**
	 * Chokidar watcher instance
	 * 
	 * @since TBD
	 * 
	 * @type {chokidar.FSWatcher}
	 */
	watcher = null;

	/**
	 * Processing callback function
	 * 
	 * @since TBD
	 * 
	 * @type {Function}
	 */
	onFileAdded = null;

	/**
	 * Debounce timers
	 * 
	 * @since TBD
	 * 
	 * @type {Map}
	 */
	debounceTimers = new Map();

	/**
	 * Files currently being processed
	 * 
	 * @since TBD
	 * 
	 * @type {Set}
	 */
	processingFiles = new Set();

	/**
	 * Watch statistics
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	stats = {
		filesDetected: 0,
		filesProcessed: 0,
		filesSkipped: 0,
		filesErrored: 0,
		startTime: Date.now()
	};

	/**
	 * Constructor
	 * 
	 * @since TBD
	 * 
	 * @param {Object}   config       Watcher configuration.
	 * @param {Function} onFileAdded  Callback function for new files.
	 */
	constructor(config, onFileAdded) {
		this.config = config;
		this.onFileAdded = onFileAdded;
	}

	/**
	 * Start watching the uploads directory
	 * 
	 * @since TBD
	 * 
	 * @param {string} watchPath Path to watch for new files.
	 * 
	 * @return {Promise<void>}
	 */
	async startWatching(watchPath) {
		if (this.watcher) {
			logger.warn('File watcher already running');
			return;
		}

		try {
			// Ensure watch path exists
			await fs.ensureDir(watchPath);

			logger.info(`Starting file watcher on: ${watchPath}`);

			// Create watcher with configuration
			this.watcher = chokidar.watch(watchPath, {
				ignored: this.config.ignored,
				persistent: true,
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 2000,
					pollInterval: 100
				},
				depth: 99,
				alwaysStat: true
			});

			// Set up event handlers
			this.setupEventHandlers();

			// Wait for watcher to be ready
			await new Promise((resolve, reject) => {
				this.watcher.on('ready', () => {
					logger.info('File watcher ready and monitoring for changes');
					resolve();
				});

				this.watcher.on('error', (error) => {
					logger.error('File watcher error:', error);
					reject(error);
				});

				// Timeout after 30 seconds
				setTimeout(() => {
					reject(new Error('File watcher initialization timeout'));
				}, 30000);
			});

		} catch (error) {
			logger.error('Failed to start file watcher:', error.message);
			throw error;
		}
	}

	/**
	 * Stop the file watcher
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async stopWatching() {
		if (!this.watcher) {
			return;
		}

		logger.info('Stopping file watcher...');

		try {
			await this.watcher.close();
			this.watcher = null;
			
			// Clear any pending debounce timers
			for (const timer of this.debounceTimers.values()) {
				clearTimeout(timer);
			}
			this.debounceTimers.clear();

			logger.info('File watcher stopped');

		} catch (error) {
			logger.error('Error stopping file watcher:', error.message);
		}
	}

	/**
	 * Setup event handlers for the file watcher
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	setupEventHandlers() {
		// Handle new files
		this.watcher.on('add', (filePath, stats) => {
			this.handleFileEvent('add', filePath, stats);
		});

		// Handle file changes
		this.watcher.on('change', (filePath, stats) => {
			this.handleFileEvent('change', filePath, stats);
		});

		// Handle file deletions
		this.watcher.on('unlink', (filePath) => {
			this.handleFileEvent('unlink', filePath);
		});

		// Handle errors
		this.watcher.on('error', (error) => {
			logger.error('File watcher error:', error);
		});
	}

	/**
	 * Handle file system events
	 * 
	 * @since TBD
	 * 
	 * @param {string} event    Event type (add, change, unlink).
	 * @param {string} filePath File path.
	 * @param {Object} stats    File statistics.
	 * 
	 * @return {void}
	 */
	handleFileEvent(event, filePath, stats = null) {
		// Only process supported image files
		if (!this.isImageFile(filePath)) {
			return;
		}

		// Skip if file is being processed
		if (this.processingFiles.has(filePath)) {
			logger.debug(`Skipping ${event} event for file already being processed: ${path.basename(filePath)}`);
			return;
		}

		this.stats.filesDetected++;

		logger.debug(`File ${event}: ${path.basename(filePath)}`, {
			event,
			size: stats ? stats.size : 0,
			path: filePath
		});

		// Handle different events
		switch (event) {
			case 'add':
			case 'change':
				this.debounceFileProcessing(filePath, stats);
				break;
				
			case 'unlink':
				this.handleFileDeleted(filePath);
				break;
		}
	}

	/**
	 * Debounce file processing to avoid processing files multiple times
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath File path.
	 * @param {Object} stats    File statistics.
	 * 
	 * @return {void}
	 */
	debounceFileProcessing(filePath, stats) {
		// Clear existing timer
		if (this.debounceTimers.has(filePath)) {
			clearTimeout(this.debounceTimers.get(filePath));
		}

		// Set new timer
		const timer = setTimeout(async () => {
			this.debounceTimers.delete(filePath);
			await this.processFile(filePath, stats);
		}, this.config.debounceDelay);

		this.debounceTimers.set(filePath, timer);
	}

	/**
	 * Process a detected file
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath File path.
	 * @param {Object} stats    File statistics.
	 * 
	 * @return {Promise<void>}
	 */
	async processFile(filePath, stats) {
		// Mark file as being processed
		this.processingFiles.add(filePath);

		try {
			// Validate file still exists and is accessible
			if (!await fs.pathExists(filePath)) {
				logger.debug(`File no longer exists: ${path.basename(filePath)}`);
				this.stats.filesSkipped++;
				return;
			}

			// Skip WordPress generated sizes (contain dimension pattern)
			if (this.isWordPressGeneratedSize(filePath)) {
				logger.debug(`Skipping WordPress generated size: ${path.basename(filePath)}`);
				this.stats.filesSkipped++;
				return;
			}

			// Skip backup files
			if (filePath.endsWith('.backup')) {
				logger.debug(`Skipping backup file: ${path.basename(filePath)}`);
				this.stats.filesSkipped++;
				return;
			}

			logger.info(`Processing new image: ${path.basename(filePath)}`, {
				size: stats ? stats.size : 0,
				path: filePath
			});

			// Call the processing callback
			if (this.onFileAdded) {
				await this.onFileAdded(filePath);
				this.stats.filesProcessed++;
			}

		} catch (error) {
			this.stats.filesErrored++;
			logger.error(`Failed to process file: ${path.basename(filePath)}`, {
				error: error.message,
				path: filePath
			});

		} finally {
			// Remove from processing set
			this.processingFiles.delete(filePath);
		}
	}

	/**
	 * Handle file deletion
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath Deleted file path.
	 * 
	 * @return {void}
	 */
	handleFileDeleted(filePath) {
		// Clear any pending processing
		if (this.debounceTimers.has(filePath)) {
			clearTimeout(this.debounceTimers.get(filePath));
			this.debounceTimers.delete(filePath);
		}

		this.processingFiles.delete(filePath);

		logger.debug(`File deleted: ${path.basename(filePath)}`);
	}

	/**
	 * Check if file is a supported image format
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath File path to check.
	 * 
	 * @return {boolean} True if supported image file.
	 */
	isImageFile(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
		
		return supportedExtensions.includes(ext);
	}

	/**
	 * Check if file is a WordPress generated image size
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath File path to check.
	 * 
	 * @return {boolean} True if WordPress generated size.
	 */
	isWordPressGeneratedSize(filePath) {
		const filename = path.basename(filePath, path.extname(filePath));
		
		// WordPress image sizes follow pattern: filename-widthxheight
		const dimensionPattern = /-\d+x\d+$/;
		
		return dimensionPattern.test(filename);
	}

	/**
	 * Get watcher statistics
	 * 
	 * @since TBD
	 * 
	 * @return {Object} Watcher statistics.
	 */
	getStats() {
		const uptime = Date.now() - this.stats.startTime;
		
		return {
			...this.stats,
			uptime: uptime,
			uptimeFormatted: this.formatUptime(uptime),
			queuedFiles: this.debounceTimers.size,
			processingFiles: this.processingFiles.size,
			isRunning: !!this.watcher
		};
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
	 * Reset statistics
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	resetStats() {
		this.stats = {
			filesDetected: 0,
			filesProcessed: 0,
			filesSkipped: 0,
			filesErrored: 0,
			startTime: Date.now()
		};
	}
} 