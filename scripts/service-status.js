#!/usr/bin/env bun

/**
 * Service Status Checker for WordPress Sharp Image Processing
 * 
 * Checks the status of the wp-sharp-image service across different process managers.
 * 
 * @since TBD
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Service status checker class
 * 
 * @since TBD
 */
class ServiceStatusChecker {
	/**
	 * Check status across all process managers
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkAll() {
		console.log('📊 WordPress Sharp Image Processing Service Status');
		console.log('================================================');

		await this.checkSupervisor();
		await this.checkSystemd();
		await this.checkPM2();
		await this.checkProcess();
		await this.checkLogs();
	}

	/**
	 * Check Supervisor status
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkSupervisor() {
		console.log('\n🔍 Supervisor Status:');
		try {
			const { stdout } = await execAsync('sudo supervisorctl status wp-sharp-image');
			const status = stdout.trim();
			
			if (status.includes('RUNNING')) {
				console.log('✅ Service is running via Supervisor');
				console.log(`   ${status}`);
			} else {
				console.log('⚠️  Service not running via Supervisor');
				console.log(`   ${status}`);
			}
		} catch (error) {
			console.log('❌ Supervisor not managing wp-sharp-image or not available');
		}
	}

	/**
	 * Check systemd status
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkSystemd() {
		console.log('\n🔍 systemd Status:');
		try {
			const { stdout } = await execAsync('systemctl is-active wp-sharp-image');
			const isActive = stdout.trim() === 'active';
			
			if (isActive) {
				console.log('✅ Service is running via systemd');
				
				// Get detailed status
				try {
					const { stdout: statusOutput } = await execAsync('systemctl status wp-sharp-image --no-pager');
					const lines = statusOutput.split('\n').slice(0, 5);
					lines.forEach(line => console.log(`   ${line}`));
				} catch (error) {
					// Ignore status errors
				}
			} else {
				console.log('⚠️  Service not active via systemd');
			}
		} catch (error) {
			console.log('❌ systemd not managing wp-sharp-image or not available');
		}
	}

	/**
	 * Check PM2 status
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkPM2() {
		console.log('\n🔍 PM2 Status:');
		try {
			const { stdout } = await execAsync('pm2 jlist');
			const processes = JSON.parse(stdout);
			const wpSharpProcess = processes.find(p => p.name === 'wp-sharp-image');
			
			if (wpSharpProcess) {
				const status = wpSharpProcess.pm2_env.status;
				const uptime = this.formatUptime(wpSharpProcess.pm2_env.pm_uptime);
				const memory = this.formatMemory(wpSharpProcess.monit.memory);
				const cpu = wpSharpProcess.monit.cpu;
				
				if (status === 'online') {
					console.log('✅ Service is running via PM2');
					console.log(`   Status: ${status} | Uptime: ${uptime} | Memory: ${memory} | CPU: ${cpu}%`);
				} else {
					console.log(`⚠️  Service status via PM2: ${status}`);
				}
			} else {
				console.log('❌ PM2 not managing wp-sharp-image');
			}
		} catch (error) {
			console.log('❌ PM2 not available or no processes found');
		}
	}

	/**
	 * Check for running processes
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkProcess() {
		console.log('\n🔍 Process Status:');
		try {
			const { stdout } = await execAsync('pgrep -f "wp-sharp-image|bun.*index.js"');
			const pids = stdout.trim().split('\n').filter(Boolean);
			
			if (pids.length > 0) {
				console.log(`✅ Found ${pids.length} running process(es)`);
				
				for (const pid of pids) {
					try {
						const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o pid,ppid,user,cmd --no-headers`);
						console.log(`   PID ${psOutput.trim()}`);
					} catch (error) {
						console.log(`   PID ${pid} (process details unavailable)`);
					}
				}
			} else {
				console.log('❌ No running processes found');
			}
		} catch (error) {
			console.log('❌ No running processes found');
		}
	}

	/**
	 * Check log files
	 * 
	 * @since TBD
	 * 
	 * @return {Promise<void>}
	 */
	async checkLogs() {
		console.log('\n🔍 Log Status:');
		
		const logPaths = [
			'./logs/wp-sharp-image.log',
			'/var/log/wp-sharp-image.out.log',
			'/var/log/wp-sharp-image.err.log'
		];

		for (const logPath of logPaths) {
			if (await fs.pathExists(logPath)) {
				try {
					const stats = await fs.stat(logPath);
					const size = this.formatFileSize(stats.size);
					const modified = stats.mtime.toLocaleString();
					
					console.log(`✅ ${logPath}: ${size} (modified: ${modified})`);
					
					// Show last few lines
					try {
						const { stdout } = await execAsync(`tail -n 3 "${logPath}"`);
						if (stdout.trim()) {
							console.log('   Recent entries:');
							stdout.trim().split('\n').forEach(line => {
								console.log(`   ${line}`);
							});
						}
					} catch (error) {
						// Ignore tail errors
					}
				} catch (error) {
					console.log(`⚠️  ${logPath}: Cannot read file`);
				}
			} else {
				console.log(`❌ ${logPath}: Not found`);
			}
		}
	}

	/**
	 * Format uptime in human readable format
	 * 
	 * @since TBD
	 * 
	 * @param {number} startTime Start time timestamp.
	 * 
	 * @return {string} Formatted uptime.
	 */
	formatUptime(startTime) {
		const uptime = Date.now() - startTime;
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
	 * Format memory usage
	 * 
	 * @since TBD
	 * 
	 * @param {number} bytes Memory in bytes.
	 * 
	 * @return {string} Formatted memory.
	 */
	formatMemory(bytes) {
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(1)}MB`;
	}

	/**
	 * Format file size
	 * 
	 * @since TBD
	 * 
	 * @param {number} bytes File size in bytes.
	 * 
	 * @return {string} Formatted file size.
	 */
	formatFileSize(bytes) {
		if (bytes === 0) return '0 B';
		
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}
}

// Run status check if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const checker = new ServiceStatusChecker();
	checker.checkAll().catch((error) => {
		console.error('Status check failed:', error);
		process.exit(1);
	});
}

export default ServiceStatusChecker; 