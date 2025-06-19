# WordPress Sharp Image Processing

High-performance image processing for WordPress using Sharp and Bun. This module monitors the WordPress uploads directory and automatically processes new images according to WordPress image size configurations, providing a significant performance improvement over PHP-based image processing.

## Features

- 🚀 **High Performance**: Uses Sharp (libvips) for extremely fast image processing
- 📁 **Real-time Monitoring**: Watches WordPress uploads directory for new images
- 🔄 **WordPress Integration**: Reads image sizes directly from WordPress database
- 🎨 **Modern Formats**: Optional WebP and AVIF generation
- 📊 **Monitoring & Logging**: Comprehensive logging and statistics
- 🛡️ **Graceful Shutdown**: Proper cleanup and error handling
- ⚙️ **Configurable**: Extensive configuration options

## Requirements

- **Bun**: >= 1.0.0
- **Node.js**: 18.17.0+ (for dependencies)
- **WordPress**: 5.0+
- **WP-CLI**: Latest version (for WordPress integration)

## Installation

### Quick Setup (Recommended)

1. **Navigate to the module directory**:
   ```bash
   cd wp-sharp-image
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Run the interactive setup wizard**:
   ```bash
   bun run configure
   ```
   
   This will:
   - Check system requirements
   - Detect available process managers (supervisor, systemd, PM2)
   - Create configuration file from template
   - Guide you through service setup
   - Configure the selected process manager automatically

### Manual Setup

1. **Install dependencies**:
   ```bash
   cd wp-sharp-image
   bun install
   ```

2. **Check system requirements**:
   ```bash
   bun run check
   ```

3. **Configure the application**:
   ```bash
   cp config.example.js config.js
   ```
   
   Edit `config.js` with your WordPress installation paths.

4. **Test the configuration**:
   ```bash
   bun run start
   ```

5. **Check service status**:
   ```bash
   bun run status
   ```

## Configuration

Copy `config.example.js` to `config.js` and modify according to your setup:

### WordPress Integration
The system uses wp-cli to interact with WordPress, so no database credentials are needed. WP-CLI uses WordPress's own database configuration from `wp-config.php`.

### WordPress Paths
```javascript
wordpress: {
    rootPath: '/path/to/wordpress',
    uploadsPath: '/path/to/wordpress/wp-content/uploads',
    contentPath: '/path/to/wordpress/wp-content'
}
```

### Image Processing Settings
```javascript
images: {
    quality: {
        jpeg: 90,
        webp: 80,
        png: 100,
        avif: 75
    },
    progressive: true,
    optimize: true,
    modernFormats: {
        webp: true,
        avif: false
    },
    concurrency: 4,
    backupOriginals: true
}
```

## Usage

### Development Mode
```bash
bun run dev
```

### Production Mode
```bash
bun run start
```

### Background Service

#### Using PM2
```bash
npm install -g pm2
pm2 start index.js --name wp-sharp-image --interpreter bun
pm2 save
pm2 startup
```

#### Using Supervisor
Create `/etc/supervisor/conf.d/wp-sharp-image.conf`:
```ini
[program:wp-sharp-image]
command=bun run start
directory=/path/to/dev/wp-sharp-image
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/wp-sharp-image.err.log
stdout_logfile=/var/log/wp-sharp-image.out.log
environment=NODE_ENV=production
```

Then reload supervisor:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start wp-sharp-image
```

#### Using systemd
Create `/etc/systemd/system/wp-sharp-image.service`:
```ini
[Unit]
Description=WordPress Sharp Image Processing Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/dev/wp-sharp-image
ExecStart=/usr/local/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable wp-sharp-image
sudo systemctl start wp-sharp-image
```

## WordPress Integration

### Disable PHP Image Processing

Add this to your WordPress `functions.php` or a plugin:

```php
// Disable WordPress image resizing
add_filter('intermediate_image_sizes_advanced', '__return_empty_array');

// Optional: Remove default image sizes
add_filter('intermediate_image_sizes', function($sizes) {
    return [];
});

// Prevent WordPress from generating thumbnails on upload
add_filter('wp_generate_attachment_metadata', function($metadata, $attachment_id) {
    // Let Sharp handle the processing
    return $metadata;
}, 10, 2);
```

### Monitor Processing

Check the logs to ensure images are being processed:
```bash
tail -f logs/wp-sharp-image.log
```

## File Structure

```
dev/wp-sharp-image/
├── index.js                 # Main application entry point
├── setup.js                 # Interactive setup wizard
├── package.json             # Dependencies and scripts
├── config.example.js        # Example configuration
├── config.js                # Your configuration (gitignored)
├── README.md                # This file
├── src/
│   ├── Database.js          # WordPress data access via wp-cli
│   ├── ImageProcessor.js    # Sharp image processing logic
│   ├── FileWatcher.js       # File system monitoring
│   ├── Logger.js            # Logging utilities
│   └── Prompt.js            # User interaction utilities
├── scripts/
│   ├── check-requirements.js # System requirements checker
│   └── service-status.js    # Service status checker
├── logs/                    # Log files (auto-created)
│   ├── wp-sharp-image.log   # Main log file
│   ├── exceptions.log       # Uncaught exceptions
│   └── rejections.log       # Unhandled rejections
└── supervisor/              # Service configuration examples
    ├── supervisor.conf      # Supervisor configuration
    ├── systemd.service      # systemd service file
    └── pm2.config.js        # PM2 configuration
```

## Monitoring

The service provides comprehensive monitoring and statistics:

### Log Levels
- **error**: Critical errors that require attention
- **warn**: Warnings that should be monitored
- **info**: General information and status updates
- **debug**: Detailed debugging information

### Statistics Reporting
When monitoring is enabled, the service reports statistics including:
- Total images processed
- Processing errors
- Memory usage
- File watcher statistics
- Processing performance metrics

### Health Checks
Monitor the service health by checking:
1. Log files for errors
2. Process status (`ps aux | grep bun`)
3. Database connectivity
4. File system permissions

## Troubleshooting

### Common Issues

#### Permission Errors
```bash
# Fix file permissions
sudo chown -R www-data:www-data /path/to/wordpress/wp-content/uploads
sudo chmod -R 755 /path/to/wordpress/wp-content/uploads
```

#### Database Connection Issues
- Verify database credentials in `config.js`
- Ensure MySQL/MariaDB is running
- Check firewall settings
- Verify user permissions

#### File Watcher Issues
- Check if the uploads directory exists and is writable
- Ensure sufficient inotify watches: `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf`
- Restart the service after making changes

#### Memory Issues
- Adjust Sharp concurrency in configuration
- Monitor memory usage with `htop` or similar
- Consider increasing system memory for large images

### Performance Tuning

#### Optimal Settings
```javascript
images: {
    concurrency: Math.min(4, os.cpus().length), // Match CPU cores
    quality: {
        jpeg: 85,  // Balance quality/size
        webp: 80,  // WebP is more efficient
        png: 95,   // PNG quality less critical
        avif: 70   // AVIF very efficient
    }
}
```

#### System Optimization
- Use SSD storage for better I/O performance
- Ensure adequate RAM (4GB+ recommended)
- Consider dedicated processing server for high-volume sites

## Available Commands

### Setup and Configuration
```bash
bun run configure        # Interactive setup wizard
bun run check           # Check system requirements
bun run status          # Check service status across all process managers
```

### Development and Debugging
```bash
bun run start           # Start the service
bun run dev             # Start in development mode with auto-reload
bun test                # Run tests
bun run lint            # Check code style
```

### Service Management
Once configured, you can manage the service with:

**Supervisor:**
```bash
sudo supervisorctl start wp-sharp-image
sudo supervisorctl stop wp-sharp-image
sudo supervisorctl restart wp-sharp-image
sudo supervisorctl status wp-sharp-image
```

**systemd:**
```bash
sudo systemctl start wp-sharp-image
sudo systemctl stop wp-sharp-image
sudo systemctl restart wp-sharp-image
sudo systemctl status wp-sharp-image
```

**PM2:**
```bash
pm2 start wp-sharp-image
pm2 stop wp-sharp-image
pm2 restart wp-sharp-image
pm2 status wp-sharp-image
pm2 logs wp-sharp-image
```

## Development

### Running Tests
```bash
bun test
```

### Code Linting
```bash
bun run lint
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

GPL-2.0+ - Same as WordPress

## Support

For issues and questions:
1. Check the logs first
2. Review this README
3. Check WordPress and system requirements
4. Create an issue with detailed information

---

**Note**: This module is designed to replace WordPress's built-in image processing. Ensure you have backups and test thoroughly before deploying to production. 