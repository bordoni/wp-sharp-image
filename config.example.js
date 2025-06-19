#!/usr/bin/env bun

/**
 * WordPress Sharp Image Processing Configuration
 * 
 * Copy this file to config.js and modify the values according to your setup.
 * 
 * @since TBD
 */

export default {
	/**
	 * WordPress Configuration
	 * 
	 * Database access is handled via wp-cli, which uses WordPress's own
	 * database configuration. No database credentials are needed here.
	 * 
	 * @since TBD
	 */

	/**
	 * WordPress installation paths
	 * 
	 * @since TBD
	 */
	wordpress: {
		rootPath: '/srv/www/wp.dev',
		uploadsPath: '/srv/www/wp.dev/wp-content/uploads',
		contentPath: '/srv/www/wp.dev/wp-content',

		/**
		 * Additional wp-cli arguments
		 * 
		 * These arguments will be added to all wp-cli commands.
		 * Useful for multisite, custom configurations, etc.
		 * 
		 * @since TBD
		 */
		wpCliArgs: [
			// Examples:
			// '--url=example.com',           // For multisite
			// '--user=admin',                // Run as specific user
			// '--skip-plugins',              // Skip plugin loading
			// '--skip-themes',               // Skip theme loading
			// '--debug',                     // Enable wp-cli debug mode
			// '--quiet',                     // Suppress informational messages
		]
	},

	/**
	 * Image processing configuration
	 * 
	 * @since TBD
	 */
	images: {
		/**
		 * Quality settings for different image formats
		 * 
		 * @since TBD
		 */
		quality: {
			jpeg: 90,
			webp: 80,
			png: 100,
			avif: 75
		},

		/**
		 * Enable progressive JPEG
		 * 
		 * @since TBD
		 */
		progressive: true,

		/**
		 * Enable optimization
		 * 
		 * @since TBD
		 */
		optimize: true,

		/**
		 * Enable modern format generation (WebP, AVIF)
		 * 
		 * @since TBD
		 */
		modernFormats: {
			webp: true,
			avif: false
		},

		/**
		 * Maximum concurrent image processing jobs
		 * 
		 * @since TBD
		 */
		concurrency: 4,

		/**
		 * Backup original images before processing
		 * 
		 * @since TBD
		 */
		backupOriginals: true
	},

	/**
	 * File watching configuration
	 * 
	 * @since TBD
	 */
	watcher: {
		/**
		 * File patterns to watch
		 * 
		 * @since TBD
		 */
		patterns: [
			'**/*.{jpg,jpeg,png,gif,webp,bmp,tiff}'
		],

		/**
		 * Directories to ignore
		 * 
		 * @since TBD
		 */
		ignored: [
			'**/node_modules/**',
			'**/.git/**',
			'**/thumbs/**'
		],

		/**
		 * Debounce delay in milliseconds
		 * 
		 * @since TBD
		 */
		debounceDelay: 1000
	},

	/**
	 * Logging configuration
	 * 
	 * @since TBD
	 */
	logging: {
		/**
		 * Log level: error, warn, info, debug
		 * 
		 * @since TBD
		 */
		level: 'info',

		/**
		 * Log file path
		 * 
		 * @since TBD
		 */
		file: './logs/wp-sharp-image.log',

		/**
		 * Enable console logging
		 * 
		 * @since TBD
		 */
		console: true,

		/**
		 * Maximum log file size in bytes
		 * 
		 * @since TBD
		 */
		maxSize: 10485760, // 10MB

		/**
		 * Maximum number of log files to keep
		 * 
		 * @since TBD
		 */
		maxFiles: 5
	},

	/**
	 * Performance monitoring
	 * 
	 * @since TBD
	 */
	monitoring: {
		/**
		 * Enable performance monitoring
		 * 
		 * @since TBD
		 */
		enabled: true,

		/**
		 * Statistics reporting interval in minutes
		 * 
		 * @since TBD
		 */
		reportInterval: 30
	}
}; 