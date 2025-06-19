#!/usr/bin/env bun

/**
 * WordPress Database utilities for Sharp Image Processing
 * 
 * Handles database operations for retrieving WordPress image sizes,
 * attachment metadata, and other WordPress-specific data.
 * 
 * @since TBD
 */

import mysql from 'mysql2/promise';
import { logger } from './Logger.js';

/**
 * WordPress Database class
 * 
 * @since TBD
 */
export class Database {
	/**
	 * Database connection
	 * 
	 * @since TBD
	 * 
	 * @type {mysql.Connection}
	 */
	connection = null;

	/**
	 * Database configuration
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	config = null;

	/**
	 * Constructor
	 * 
	 * @since TBD
	 * 
	 * @param {Object} config Database configuration object.
	 */
	constructor(config) {
		this.config = config;
	}

	/**
	 * Connect to the database
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if connection successful.
	 */
	async connect() {
		try {
			this.connection = await mysql.createConnection({
				host: this.config.host,
				user: this.config.user,
				password: this.config.password,
				database: this.config.database,
				charset: this.config.charset
			});

			logger.info('Database connection established');
			return true;
		} catch (error) {
			logger.error('Database connection failed:', error.message);
			return false;
		}
	}

	/**
	 * Disconnect from the database
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async disconnect() {
		if (this.connection) {
			await this.connection.end();
			this.connection = null;
			logger.info('Database connection closed');
		}
	}

	/**
	 * Get WordPress image sizes from options table
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<Object>} WordPress image sizes configuration.
	 */
	async getImageSizes() {
		try {
			const query = `
				SELECT option_value 
				FROM ${this.config.prefix}options 
				WHERE option_name IN ('thumbnail_size_w', 'thumbnail_size_h', 'thumbnail_crop',
									 'medium_size_w', 'medium_size_h', 
									 'medium_large_size_w', 'medium_large_size_h',
									 'large_size_w', 'large_size_h')
			`;

			const [rows] = await this.connection.execute(query);
			
			// Also get custom image sizes from theme options
			const customSizesQuery = `
				SELECT option_value 
				FROM ${this.config.prefix}options 
				WHERE option_name = '_wp_additional_image_sizes'
			`;

			const [customRows] = await this.connection.execute(customSizesQuery);

			// Build image sizes object
			const imageSizes = {
				thumbnail: { width: 150, height: 150, crop: true },
				medium: { width: 300, height: 300, crop: false },
				medium_large: { width: 768, height: 0, crop: false },
				large: { width: 1024, height: 1024, crop: false }
			};

			// Parse WordPress options
			for (const row of rows) {
				// This would need proper implementation based on actual option structure
				// For now, we'll use defaults
			}

			// Parse custom image sizes if they exist
			if (customRows.length > 0 && customRows[0].option_value) {
				try {
					const customSizes = JSON.parse(customRows[0].option_value);
					Object.assign(imageSizes, customSizes);
				} catch (error) {
					logger.warn('Failed to parse custom image sizes:', error.message);
				}
			}

			logger.debug('Retrieved image sizes:', imageSizes);
			return imageSizes;

		} catch (error) {
			logger.error('Failed to get image sizes:', error.message);
			
			// Return default WordPress image sizes
			return {
				thumbnail: { width: 150, height: 150, crop: true },
				medium: { width: 300, height: 300, crop: false },
				medium_large: { width: 768, height: 0, crop: false },
				large: { width: 1024, height: 1024, crop: false }
			};
		}
	}

	/**
	 * Get attachment metadata from database
	 * 
	 * @since TBD
	 * 
	 * @param {number} attachmentId The attachment ID.
	 * 
	 * @return {Promise<Object|null>} Attachment metadata or null if not found.
	 */
	async getAttachmentMeta(attachmentId) {
		try {
			const query = `
				SELECT meta_value 
				FROM ${this.config.prefix}postmeta 
				WHERE post_id = ? AND meta_key = '_wp_attachment_metadata'
			`;

			const [rows] = await this.connection.execute(query, [attachmentId]);
			
			if (rows.length === 0) {
				return null;
			}

			const metadata = JSON.parse(rows[0].meta_value);
			logger.debug(`Retrieved metadata for attachment ${attachmentId}:`, metadata);
			
			return metadata;

		} catch (error) {
			logger.error(`Failed to get attachment metadata for ID ${attachmentId}:`, error.message);
			return null;
		}
	}

	/**
	 * Update attachment metadata in database
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
			const query = `
				UPDATE ${this.config.prefix}postmeta 
				SET meta_value = ? 
				WHERE post_id = ? AND meta_key = '_wp_attachment_metadata'
			`;

			const metadataJson = JSON.stringify(metadata);
			await this.connection.execute(query, [metadataJson, attachmentId]);
			
			logger.debug(`Updated metadata for attachment ${attachmentId}`);
			return true;

		} catch (error) {
			logger.error(`Failed to update attachment metadata for ID ${attachmentId}:`, error.message);
			return false;
		}
	}

	/**
	 * Get attachment ID by file path
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath The relative file path from uploads directory.
	 * 
	 * @return {Promise<number|null>} Attachment ID or null if not found.
	 */
	async getAttachmentIdByPath(filePath) {
		try {
			const query = `
				SELECT p.ID 
				FROM ${this.config.prefix}posts p
				INNER JOIN ${this.config.prefix}postmeta pm ON p.ID = pm.post_id
				WHERE p.post_type = 'attachment' 
				AND pm.meta_key = '_wp_attached_file' 
				AND pm.meta_value = ?
			`;

			const [rows] = await this.connection.execute(query, [filePath]);
			
			if (rows.length === 0) {
				return null;
			}

			const attachmentId = parseInt(rows[0].ID);
			logger.debug(`Found attachment ID ${attachmentId} for path: ${filePath}`);
			
			return attachmentId;

		} catch (error) {
			logger.error(`Failed to get attachment ID for path ${filePath}:`, error.message);
			return null;
		}
	}

	/**
	 * Check if database connection is alive
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if connection is alive.
	 */
	async isConnected() {
		if (!this.connection) {
			return false;
		}

		try {
			await this.connection.ping();
			return true;
		} catch (error) {
			logger.warn('Database connection lost:', error.message);
			return false;
		}
	}

	/**
	 * Reconnect to database if connection is lost
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<boolean>} True if reconnection successful.
	 */
	async reconnect() {
		logger.info('Attempting to reconnect to database...');
		
		if (this.connection) {
			try {
				await this.connection.end();
			} catch (error) {
				// Ignore errors when closing dead connection
			}
			this.connection = null;
		}

		return await this.connect();
	}
} 