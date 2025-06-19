#!/usr/bin/env node

/**
 * PM2 Configuration for WordPress Sharp Image Processing
 * 
 * @since TBD
 */

module.exports = {
	apps: [
		{
			name: 'wp-sharp-image',
			script: 'index.js',
			interpreter: 'bun',
			cwd: '{{WORKING_DIRECTORY}}',
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			watch: false,
			max_memory_restart: '1G',
			error_file: './logs/pm2-error.log',
			out_file: './logs/pm2-out.log',
			log_file: './logs/pm2-combined.log',
			time: true,
			env: {
				NODE_ENV: 'development'
			},
			env_production: {
				NODE_ENV: 'production'
			},
			min_uptime: '10s',
			max_restarts: 10,
			restart_delay: 4000,
			kill_timeout: 5000,
			listen_timeout: 3000,
			shutdown_with_message: true,
			wait_ready: true
		}
	]
}; 