#!/usr/bin/env bun

/**
 * WordPress Database utilities for Sharp Image Processing
 * 
 * Handles WordPress data operations using wp-cli for safe and reliable
 * interaction with WordPress database and configuration.
 * 
 * @since TBD
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from './Logger.js';

const execAsync = promisify(exec);

/**
 * WordPress Database class using wp-cli
 * 
 * @since TBD
 */
export class Database {
	/**
	 * WordPress root path
	 * 
	 * @since TBD
	 * 
	 * @type {string}
	 */
	wordpressPath = null;

	/**
	 * wp-cli command prefix
	 * 
	 * @since TBD
	 * 
	 * @type {string}
	 */
	wpCliCommand = null;

	/**
	 * Constructor
	 * 
	 * @since TBD
	 * 
	 * @param {Object} config Configuration object with WordPress path.
	 */
	constructor(config) {
		this.wordpressPath = config.wordpress.rootPath;
		this.wpCliCommand = `wp --path="${this.wordpressPath}"`;
	}

	/**
	 * Test wp-cli connectivity and WordPress installation
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if wp-cli and WordPress are accessible.
	 */
	async connect() {
		try {
			// Test wp-cli availability and WordPress installation
			const { stdout } = await execAsync(`${this.wpCliCommand} core version`);
			const wpVersion = stdout.trim();
			
			logger.info(`WordPress connection established (version: ${wpVersion})`);
			return true;
		} catch (error) {
			logger.error('WordPress connection failed:', error.message);
			logger.error('Make sure wp-cli is installed and WordPress path is correct');
			return false;
		}
	}

	/**
	 * Disconnect (no-op for wp-cli)
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async disconnect() {
		// No persistent connection to close with wp-cli
		logger.debug('WordPress connection closed (wp-cli mode)');
	}

	/**
	 * Get WordPress image sizes from options and theme
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<Object>} WordPress image sizes configuration.
	 */
	async getImageSizes() {
		try {
			// Get core image size settings
			const [thumbnailW, thumbnailH, thumbnailCrop, mediumW, mediumH, largeW, largeH] = await Promise.all([
				this.getOption('thumbnail_size_w', '150'),
				this.getOption('thumbnail_size_h', '150'),
				this.getOption('thumbnail_crop', '1'),
				this.getOption('medium_size_w', '300'),
				this.getOption('medium_size_h', '300'),
				this.getOption('large_size_w', '1024'),
				this.getOption('large_size_h', '1024')
			]);

			// Build image sizes object
			const imageSizes = {
				thumbnail: {
					width: parseInt(thumbnailW) || 150,
					height: parseInt(thumbnailH) || 150,
					crop: thumbnailCrop === '1'
				},
				medium: {
					width: parseInt(mediumW) || 300,
					height: parseInt(mediumH) || 300,
					crop: false
				},
				large: {
					width: parseInt(largeW) || 1024,
					height: parseInt(largeH) || 1024,
					crop: false
				}
			};

			// Get additional image sizes from theme
			try {
				const additionalSizes = await this.getOption('_wp_additional_image_sizes', '');
				if (additionalSizes) {
					const customSizes = JSON.parse(additionalSizes);
					Object.assign(imageSizes, customSizes);
				}
			} catch (error) {
				logger.debug('No additional image sizes found or failed to parse');
			}

			// Get sizes registered by themes/plugins
			try {
				const { stdout } = await execAsync(`${this.wpCliCommand} eval "echo json_encode(wp_get_additional_image_sizes());"`);
				const additionalSizes = JSON.parse(stdout.trim());
				
				for (const [name, size] of Object.entries(additionalSizes)) {
					imageSizes[name] = {
						width: parseInt(size.width) || 0,
						height: parseInt(size.height) || 0,
						crop: Boolean(size.crop)
					};
				}
			} catch (error) {
				logger.debug('Could not retrieve additional theme image sizes');
			}

			logger.debug('Retrieved image sizes:', imageSizes);
			return imageSizes;

		} catch (error) {
			logger.error('Failed to get image sizes:', error.message);
			
			// Return safe defaults
			return {
				thumbnail: { width: 150, height: 150, crop: true },
				medium: { width: 300, height: 300, crop: false },
				large: { width: 1024, height: 1024, crop: false }
			};
		}
	}

	/**
	 * Get attachment metadata using wp-cli
	 * 
	 * @since TBD
	 * 
	 * @param {number} attachmentId The attachment ID.
	 * 
	 * @return {Promise<Object|null>} Attachment metadata or null if not found.
	 */
	async getAttachmentMeta(attachmentId) {
		try {
			const { stdout } = await execAsync(
				`${this.wpCliCommand} post meta get ${attachmentId} _wp_attachment_metadata --format=json`
			);

			const metadata = JSON.parse(stdout.trim());
			logger.debug(`Retrieved metadata for attachment ${attachmentId}:`, metadata);
			
			return metadata;

		} catch (error) {
			logger.debug(`No metadata found for attachment ${attachmentId}: ${error.message}`);
			return null;
		}
	}

	/**
	 * Update attachment metadata using wp-cli
	 * 
	 * @since TBD
	 * 
	 * @param {number} attachmentId The attachment ID.
	 * @param {Object} metadata     The metadata object to save.
	 * 
	 * @return {Promise<boolean>} True if update successful.
	 */
	async updateAttachmentMeta(attachmentId, metadata) {
		try {
			const metadataJson = JSON.stringify(metadata).replace(/"/g, '\\"');
			
			await execAsync(
				`${this.wpCliCommand} post meta update ${attachmentId} _wp_attachment_metadata '${metadataJson}'`
			);
			
			logger.debug(`Updated metadata for attachment ${attachmentId}`);
			return true;

		} catch (error) {
			logger.error(`Failed to update attachment metadata for ID ${attachmentId}:`, error.message);
			return false;
		}
	}

	/**
	 * Get attachment ID by file path using wp-cli
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath The relative file path from uploads directory.
	 * 
	 * @return {Promise<number|null>} Attachment ID or null if not found.
	 */
	async getAttachmentIdByPath(filePath) {
		try {
			// Get table prefix first
			const { stdout: prefix } = await execAsync(`${this.wpCliCommand} config get table_prefix`);
			const tablePrefix = prefix.trim();

			// Use wp-cli to find attachment by file path  
			const { stdout } = await execAsync(
				`${this.wpCliCommand} db query "SELECT p.ID FROM ${tablePrefix}posts p INNER JOIN ${tablePrefix}postmeta pm ON p.ID = pm.post_id WHERE p.post_type = 'attachment' AND pm.meta_key = '_wp_attached_file' AND pm.meta_value = '${filePath}'" --skip-column-names`
			);

			const attachmentId = parseInt(stdout.trim());
			
			if (isNaN(attachmentId)) {
				return null;
			}

			logger.debug(`Found attachment ID ${attachmentId} for path: ${filePath}`);
			return attachmentId;

		} catch (error) {
			logger.debug(`Failed to get attachment ID for path ${filePath}:`, error.message);
			return null;
		}
	}

	/**
	 * Get attachment ID by file path using wp-cli media command (alternative method)
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath The relative file path from uploads directory.
	 * 
	 * @return {Promise<number|null>} Attachment ID or null if not found.
	 */
	async findAttachmentByPath(filePath) {
		try {
			// Extract filename for search
			const filename = path.basename(filePath);
			
			// Search for attachment by filename
			const { stdout } = await execAsync(
				`${this.wpCliCommand} post list --post_type=attachment --meta_key=_wp_attached_file --meta_value=${filePath} --field=ID --format=csv`
			);

			const attachmentIds = stdout.trim().split('\n').filter(Boolean);
			
			if (attachmentIds.length === 0) {
				return null;
			}

			const attachmentId = parseInt(attachmentIds[0]);
			logger.debug(`Found attachment ID ${attachmentId} for path: ${filePath}`);
			
			return attachmentId;

		} catch (error) {
			logger.debug(`Failed to find attachment for path ${filePath}:`, error.message);
			return null;
		}
	}

	/**
	 * Get WordPress option value using wp-cli
	 * 
	 * @since TBD
	 * 
	 * @param {string} optionName    The option name.
	 * @param {string} defaultValue  Default value if option doesn't exist.
	 * 
	 * @return {Promise<string>} Option value or default.
	 */
	async getOption(optionName, defaultValue = '') {
		try {
			const { stdout } = await execAsync(
				`${this.wpCliCommand} option get ${optionName}`
			);

			return stdout.trim();

		} catch (error) {
			logger.debug(`Option ${optionName} not found, using default: ${defaultValue}`);
			return defaultValue;
		}
	}

	/**
	 * Set WordPress option value using wp-cli
	 * 
	 * @since TBD
	 * 
	 * @param {string} optionName  The option name.
	 * @param {string} optionValue The option value.
	 * 
	 * @return {Promise<boolean>} True if update successful.
	 */
	async setOption(optionName, optionValue) {
		try {
			await execAsync(
				`${this.wpCliCommand} option update ${optionName} '${optionValue}'`
			);

			logger.debug(`Updated option ${optionName}`);
			return true;

		} catch (error) {
			logger.error(`Failed to update option ${optionName}:`, error.message);
			return false;
		}
	}

	/**
	 * Check if wp-cli and WordPress are accessible
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if accessible.
	 */
	async isConnected() {
		try {
			await execAsync(`${this.wpCliCommand} core version`);
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Test WordPress connectivity (alias for isConnected)
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if reconnection successful.
	 */
	async reconnect() {
		logger.info('Testing WordPress connectivity via wp-cli...');
		return await this.isConnected();
	}

	/**
	 * Get WordPress uploads directory info
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<Object|null>} Uploads directory info or null if failed.
	 */
	async getUploadsInfo() {
		try {
			const { stdout } = await execAsync(
				`${this.wpCliCommand} eval "echo json_encode(wp_upload_dir());"`
			);

			const uploadsInfo = JSON.parse(stdout.trim());
			logger.debug('Retrieved uploads directory info:', uploadsInfo);
			
			return uploadsInfo;

		} catch (error) {
			logger.error('Failed to get uploads directory info:', error.message);
			return null;
		}
	}

	/**
	 * Get WordPress configuration info
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<Object>} WordPress configuration details.
	 */
	async getWordPressInfo() {
		try {
			const [version, siteUrl, homeUrl, uploadsInfo] = await Promise.all([
				execAsync(`${this.wpCliCommand} core version`),
				execAsync(`${this.wpCliCommand} option get siteurl`),
				execAsync(`${this.wpCliCommand} option get home`),
				this.getUploadsInfo()
			]);

			return {
				version: version.stdout.trim(),
				siteUrl: siteUrl.stdout.trim(),
				homeUrl: homeUrl.stdout.trim(),
				uploads: uploadsInfo
			};

		} catch (error) {
			logger.error('Failed to get WordPress info:', error.message);
			return {
				version: 'Unknown',
				siteUrl: 'Unknown',
				homeUrl: 'Unknown',
				uploads: null
			};
		}
	}
} 