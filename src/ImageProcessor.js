#!/usr/bin/env bun

/**
 * WordPress Sharp Image Processor
 * 
 * Handles high-performance image processing using Sharp library
 * following WordPress naming conventions and size configurations.
 * 
 * @since TBD
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs-extra';
import { logger, logPerformance } from './Logger.js';

/**
 * WordPress Image Processor class
 * 
 * @since TBD
 */
export class ImageProcessor {
	/**
	 * Image processing configuration
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	config = null;

	/**
	 * WordPress image sizes
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	imageSizes = {};

	/**
	 * Processing queue
	 * 
	 * @since TBD
	 * 
	 * @type {Array}
	 */
	processingQueue = [];

	/**
	 * Currently processing files
	 * 
	 * @since TBD
	 * 
	 * @type {Set}
	 */
	processing = new Set();

	/**
	 * Processing statistics
	 * 
	 * @since TBD
	 * 
	 * @type {Object}
	 */
	stats = {
		processed: 0,
		failed: 0,
		totalTime: 0,
		averageTime: 0
	};

	/**
	 * Constructor
	 * 
	 * @since TBD
	 * 
	 * @param {Object} config      Image processing configuration.
	 * @param {Object} imageSizes  WordPress image sizes configuration.
	 */
	constructor(config, imageSizes = {}) {
		this.config = config;
		this.imageSizes = imageSizes;

		// Configure Sharp
		sharp.cache(false); // Disable cache for production use
		sharp.concurrency(config.concurrency || 4);

		logger.info('ImageProcessor initialized', {
			concurrency: config.concurrency || 4,
			imageSizes: Object.keys(imageSizes).length
		});
	}

	/**
	 * Update image sizes configuration
	 * 
	 * @since TBD
	 * 
	 * @param {Object} imageSizes WordPress image sizes configuration.
	 * 
	 * @return {void}
	 */
	updateImageSizes(imageSizes) {
		this.imageSizes = imageSizes;
		logger.info('Image sizes updated', {
			sizes: Object.keys(imageSizes).length
		});
	}

	/**
	 * Process a single image file
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath Absolute path to the image file.
	 * 
	 * @return {Promise<Object>} Processing results with metadata.
	 */
	async processImage(filePath) {
		const startTime = Date.now();
		
		if (this.processing.has(filePath)) {
			logger.debug(`Image already being processed: ${filePath}`);
			return null;
		}

		this.processing.add(filePath);

		try {
			// Validate image file
			if (!await this.isValidImage(filePath)) {
				throw new Error('Invalid or unsupported image format');
			}

			// Backup original if configured
			if (this.config.backupOriginals) {
				await this.backupOriginal(filePath);
			}

			// Get image metadata
			const image = sharp(filePath);
			const metadata = await image.metadata();

			logger.info(`Processing image: ${path.basename(filePath)}`, {
				width: metadata.width,
				height: metadata.height,
				format: metadata.format,
				size: (await fs.stat(filePath)).size
			});

			// Generate image sizes
			const generatedSizes = await this.generateImageSizes(filePath, metadata);

			// Create WordPress metadata structure
			const wpMetadata = await this.createWordPressMetadata(filePath, metadata, generatedSizes);

			this.stats.processed++;
			this.stats.totalTime += (Date.now() - startTime);
			this.stats.averageTime = this.stats.totalTime / this.stats.processed;

			logPerformance('Image Processing', startTime, {
				file: path.basename(filePath),
				sizes: generatedSizes.length,
				originalSize: metadata.width + 'x' + metadata.height
			});

			return wpMetadata;

		} catch (error) {
			this.stats.failed++;
			logger.error(`Failed to process image: ${filePath}`, {
				error: error.message,
				stack: error.stack
			});
			throw error;

		} finally {
			this.processing.delete(filePath);
		}
	}

	/**
	 * Generate all WordPress image sizes for a given image
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath Original image file path.
	 * @param {Object} metadata Original image metadata.
	 * 
	 * @return {Promise<Array>} Array of generated image information.
	 */
	async generateImageSizes(filePath, metadata) {
		const generatedSizes = [];
		const fileInfo = path.parse(filePath);
		const uploadsDir = path.dirname(filePath);

		// Process each configured image size
		for (const [sizeName, sizeConfig] of Object.entries(this.imageSizes)) {
			try {
				const resizedImage = await this.resizeImage(filePath, sizeConfig, metadata);
				
				if (resizedImage) {
					// Generate filename for the size
					const sizeFilename = this.generateSizeFilename(fileInfo, resizedImage.width, resizedImage.height);
					const sizeFilePath = path.join(uploadsDir, sizeFilename);

					// Save the resized image
					await resizedImage.image.toFile(sizeFilePath);

					// Generate modern formats if enabled
					const modernFormats = [];
					if (this.config.modernFormats.webp) {
						const webpPath = path.join(uploadsDir, this.generateSizeFilename(fileInfo, resizedImage.width, resizedImage.height, 'webp'));
						await resizedImage.image.webp({ quality: this.config.quality.webp }).toFile(webpPath);
						modernFormats.push({
							format: 'webp',
							file: path.basename(webpPath),
							width: resizedImage.width,
							height: resizedImage.height
						});
					}

					if (this.config.modernFormats.avif) {
						const avifPath = path.join(uploadsDir, this.generateSizeFilename(fileInfo, resizedImage.width, resizedImage.height, 'avif'));
						await resizedImage.image.avif({ quality: this.config.quality.avif }).toFile(avifPath);
						modernFormats.push({
							format: 'avif',
							file: path.basename(avifPath),
							width: resizedImage.width,
							height: resizedImage.height
						});
					}

					generatedSizes.push({
						size: sizeName,
						file: path.basename(sizeFilePath),
						width: resizedImage.width,
						height: resizedImage.height,
						'mime-type': `image/${this.getImageFormat(sizeFilePath)}`,
						modernFormats
					});

					logger.debug(`Generated ${sizeName} size: ${resizedImage.width}x${resizedImage.height}`);
				}

			} catch (error) {
				logger.warn(`Failed to generate ${sizeName} size for ${path.basename(filePath)}:`, error.message);
			}
		}

		return generatedSizes;
	}

	/**
	 * Resize image according to WordPress size configuration
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath    Original image file path.
	 * @param {Object} sizeConfig  Size configuration object.
	 * @param {Object} metadata    Original image metadata.
	 * 
	 * @return {Promise<Object|null>} Resized image data or null if not needed.
	 */
	async resizeImage(filePath, sizeConfig, metadata) {
		const { width: maxWidth, height: maxHeight, crop = false } = sizeConfig;

		// Skip if original is smaller than target and we're not cropping
		if (!crop && metadata.width <= maxWidth && metadata.height <= maxHeight) {
			return null;
		}

		const image = sharp(filePath);

		// Apply image processing options
		if (this.config.optimize) {
			image.jpeg({ 
				quality: this.config.quality.jpeg,
				progressive: this.config.progressive
			});
			image.png({ 
				quality: this.config.quality.png,
				progressive: this.config.progressive
			});
		}

		let resizeOptions = {};
		let finalWidth, finalHeight;

		if (crop) {
			// WordPress-style crop behavior
			resizeOptions = {
				width: maxWidth,
				height: maxHeight,
				fit: 'cover',
				position: 'center'
			};
			finalWidth = maxWidth;
			finalHeight = maxHeight;

		} else {
			// Proportional resize to fit within bounds
			const aspectRatio = metadata.width / metadata.height;

			if (maxHeight === 0) {
				// Width only constraint
				finalWidth = Math.min(maxWidth, metadata.width);
				finalHeight = Math.round(finalWidth / aspectRatio);
			} else {
				// Both width and height constraints
				const widthRatio = maxWidth / metadata.width;
				const heightRatio = maxHeight / metadata.height;
				const ratio = Math.min(widthRatio, heightRatio, 1);

				finalWidth = Math.round(metadata.width * ratio);
				finalHeight = Math.round(metadata.height * ratio);
			}

			resizeOptions = {
				width: finalWidth,
				height: finalHeight,
				fit: 'inside',
				withoutEnlargement: true
			};
		}

		image.resize(resizeOptions);

		return {
			image,
			width: finalWidth,
			height: finalHeight
		};
	}

	/**
	 * Generate WordPress-style filename for image size
	 * 
	 * @since TBD
	 * 
	 * @param {Object} fileInfo  Parsed file information.
	 * @param {number} width     Image width.
	 * @param {number} height    Image height.
	 * @param {string} format    Optional format override.
	 * 
	 * @return {string} Generated filename.
	 */
	generateSizeFilename(fileInfo, width, height, format = null) {
		const extension = format || fileInfo.ext.slice(1);
		return `${fileInfo.name}-${width}x${height}.${extension}`;
	}

	/**
	 * Create WordPress metadata structure
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath       Original file path.
	 * @param {Object} metadata       Image metadata.
	 * @param {Array}  generatedSizes Generated sizes data.
	 * 
	 * @return {Promise<Object>} WordPress metadata structure.
	 */
	async createWordPressMetadata(filePath, metadata, generatedSizes) {
		const fileInfo = path.parse(filePath);
		const stats = await fs.stat(filePath);

		const wpMetadata = {
			width: metadata.width,
			height: metadata.height,
			file: path.basename(filePath),
			filesize: stats.size,
			sizes: {},
			image_meta: {
				aperture: metadata.exif?.FNumber || '0',
				credit: '',
				camera: metadata.exif?.Make || '',
				caption: '',
				created_timestamp: Math.floor(stats.birthtime.getTime() / 1000),
				copyright: '',
				focal_length: metadata.exif?.FocalLength || '0',
				iso: metadata.exif?.ISO || '0',
				shutter_speed: metadata.exif?.ExposureTime || '0',
				title: '',
				orientation: metadata.orientation || '1'
			}
		};

		// Add generated sizes
		for (const size of generatedSizes) {
			const sizePath = path.join(path.dirname(filePath), size.file);
			const sizeStats = await fs.stat(sizePath);
			
			wpMetadata.sizes[size.size] = {
				file: size.file,
				width: size.width,
				height: size.height,
				'mime-type': size['mime-type'],
				filesize: sizeStats.size
			};

			// Add modern formats
			if (size.modernFormats && size.modernFormats.length > 0) {
				wpMetadata.sizes[size.size].sources = {};
				for (const format of size.modernFormats) {
					const formatPath = path.join(path.dirname(filePath), format.file);
					const formatStats = await fs.stat(formatPath);
					
					wpMetadata.sizes[size.size].sources[format.format] = [{
						file: format.file,
						filesize: formatStats.size
					}];
				}
			}
		}

		return wpMetadata;
	}

	/**
	 * Validate if file is a supported image
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath File path to validate.
	 * 
	 * @return {Promise<boolean>} True if valid image.
	 */
	async isValidImage(filePath) {
		try {
			if (!await fs.pathExists(filePath)) {
				return false;
			}

			const metadata = await sharp(filePath).metadata();
			return !!(metadata.width && metadata.height);

		} catch (error) {
			logger.debug(`Invalid image file: ${filePath}`, error.message);
			return false;
		}
	}

	/**
	 * Backup original image file
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath Original file path.
	 * 
	 * @return {Promise<void>}
	 */
	async backupOriginal(filePath) {
		const backupPath = filePath + '.backup';
		
		if (!await fs.pathExists(backupPath)) {
			await fs.copy(filePath, backupPath);
			logger.debug(`Backed up original: ${path.basename(filePath)}`);
		}
	}

	/**
	 * Get image format from file extension
	 * 
	 * @since TBD
	 * 
	 * @param {string} filePath File path.
	 * 
	 * @return {string} Image format.
	 */
	getImageFormat(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		const formatMap = {
			'.jpg': 'jpeg',
			'.jpeg': 'jpeg',
			'.png': 'png',
			'.gif': 'gif',
			'.webp': 'webp',
			'.avif': 'avif',
			'.bmp': 'bmp',
			'.tiff': 'tiff',
			'.tif': 'tiff'
		};

		return formatMap[ext] || 'jpeg';
	}

	/**
	 * Get processing statistics
	 * 
	 * @since TBD
	 * 
	 * @return {Object} Processing statistics.
	 */
	getStats() {
		return {
			...this.stats,
			queueLength: this.processingQueue.length,
			currentlyProcessing: this.processing.size
		};
	}

	/**
	 * Reset processing statistics
	 * 
	 * @since TBD
	 * 
	 * @return {void}
	 */
	resetStats() {
		this.stats = {
			processed: 0,
			failed: 0,
			totalTime: 0,
			averageTime: 0
		};
	}
} 