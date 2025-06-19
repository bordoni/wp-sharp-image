#!/usr/bin/env bun

/**
 * Logging utilities for WordPress Sharp Image Processing
 * 
 * Provides structured logging with file rotation and console output
 * using Winston logger.
 * 
 * @since TBD
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

/**
 * Create and configure the logger instance
 * 
 * @since TBD
 * 
 * @param {Object} config Logging configuration object.
 * 
 * @return {winston.Logger} Configured Winston logger instance.
 */
function createLogger(config = {}) {
	// Default configuration
	const defaultConfig = {
		level: 'info',
		file: './logs/wp-sharp-image.log',
		console: true,
		maxSize: 10485760, // 10MB
		maxFiles: 5
	};

	const logConfig = { ...defaultConfig, ...config };

	// Ensure logs directory exists
	const logDir = path.dirname(logConfig.file);
	fs.ensureDirSync(logDir);

	// Create transports array
	const transports = [];

	// File transport with rotation
	transports.push(
		new winston.transports.File({
			filename: logConfig.file,
			level: logConfig.level,
			maxsize: logConfig.maxSize,
			maxFiles: logConfig.maxFiles,
			tailable: true,
			format: winston.format.combine(
				winston.format.timestamp(),
				winston.format.errors({ stack: true }),
				winston.format.json()
			)
		})
	);

	// Console transport if enabled
	if (logConfig.console) {
		transports.push(
			new winston.transports.Console({
				level: logConfig.level,
				format: winston.format.combine(
					winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
					winston.format.errors({ stack: true }),
					winston.format.colorize(),
					winston.format.printf(({ timestamp, level, message, ...meta }) => {
						const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
						return `${timestamp} [${level}]: ${message} ${metaStr}`;
					})
				)
			})
		);
	}

	// Create the logger
	return winston.createLogger({
		level: logConfig.level,
		transports,
		// Handle uncaught exceptions and rejections
		exceptionHandlers: [
			new winston.transports.File({
				filename: path.join(logDir, 'exceptions.log'),
				format: winston.format.combine(
					winston.format.timestamp(),
					winston.format.errors({ stack: true }),
					winston.format.json()
				)
			})
		],
		rejectionHandlers: [
			new winston.transports.File({
				filename: path.join(logDir, 'rejections.log'),
				format: winston.format.combine(
					winston.format.timestamp(),
					winston.format.errors({ stack: true }),
					winston.format.json()
				)
			})
		]
	});
}

/**
 * Default logger instance
 * Will be configured when the module is imported
 * 
 * @since TBD
 * 
 * @type {winston.Logger}
 */
export let logger = createLogger();

/**
 * Configure the logger with new settings
 * 
 * @since TBD
 * 
 * @param {Object} config Logging configuration object.
 * 
 * @return {winston.Logger} Reconfigured logger instance.
 */
export function configureLogger(config) {
	// Close existing logger transports
	logger.clear();
	logger.close();

	// Create new logger with updated config
	logger = createLogger(config);
	
	return logger;
}

/**
 * Log performance metrics
 * 
 * @since TBD
 * 
 * @param {string} operation  The operation being measured.
 * @param {number} startTime  Start time in milliseconds.
 * @param {Object} metadata   Additional metadata to log.
 * 
 * @return {void}
 */
export function logPerformance(operation, startTime, metadata = {}) {
	const duration = Date.now() - startTime;
	
	logger.info(`Performance: ${operation}`, {
		operation,
		duration: `${duration}ms`,
		...metadata
	});
}

/**
 * Create a child logger with specific context
 * 
 * @since TBD
 * 
 * @param {Object} context Context object to include in all log messages.
 * 
 * @return {winston.Logger} Child logger instance.
 */
export function createChildLogger(context) {
	return logger.child(context);
}

/**
 * Log system stats
 * 
 * @since TBD
 * 
 * @param {Object} stats System statistics object.
 * 
 * @return {void}
 */
export function logStats(stats) {
	logger.info('System Statistics', {
		type: 'stats',
		...stats
	});
} 