# Sharp Image Processing WordPress Integration

WordPress mu-plugins (must-use plugins) that integrate WordPress with the Sharp image processing service.

## Available Plugins

### 1. `sharp-image-processing.php` (Full Integration)
**Recommended for production sites**

**Features:**
- ✅ Disables WordPress built-in image processing
- ✅ Dashboard widget showing service status
- ✅ Admin notifications for service health
- ✅ Automatic service monitoring and health checks
- ✅ Smart image size handling with fallbacks
- ✅ Responsive image (srcset) support
- ✅ Integration with Sharp-generated images
- ✅ Service statistics and error reporting
- ✅ AJAX-powered status refreshing
- ✅ Visual indicators for disabled image settings

### 2. `sharp-image-processing-simple.php` (Minimal Integration)
**Recommended for development or simple setups**

**Features:**
- ✅ Disables WordPress built-in image processing
- ✅ Visually disables image size settings in admin
- ✅ Shows admin notices about Sharp integration
- ✅ Lightweight with minimal overhead

## Installation

Copy the plugin file(s) to your WordPress mu-plugins directory:

### Option 1: Full Integration (Recommended)
```bash
cp sharp-image-processing.php /path/to/wordpress/wp-content/mu-plugins/
```

### Option 2: Simple Integration  
```bash
cp sharp-image-processing-simple.php /path/to/wordpress/wp-content/mu-plugins/
```

### Option 3: Both Plugins
You can install both and choose which one to use by renaming:
```bash
cp sharp-image-processing.php /path/to/wordpress/wp-content/mu-plugins/
cp sharp-image-processing-simple.php /path/to/wordpress/wp-content/mu-plugins/sharp-simple.php.disabled
```

## How WordPress Image Settings Are Handled

### The Problem
WordPress doesn't provide a clean API to completely remove the image size settings from the Media Settings page, so these plugins use a multi-layered approach:

### The Solution

#### 1. **Disable Image Processing** (Both Plugins)
```php
// Remove all intermediate sizes
add_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 99 );
add_filter( 'intermediate_image_sizes', '__return_empty_array', 99 );

// Disable image editors
add_filter( 'wp_image_editors', '__return_empty_array', 99 );

// Prevent thumbnail generation
add_filter( 'wp_generate_attachment_metadata', 'prevent_thumbnail_generation', 10, 2 );
```

#### 2. **Override Setting Values** (Both Plugins)
```php
// Force all image size settings to return 0
add_filter( 'pre_option_thumbnail_size_w', '__return_zero' );
add_filter( 'pre_option_thumbnail_size_h', '__return_zero' );
add_filter( 'pre_option_thumbnail_crop', '__return_zero' );
add_filter( 'pre_option_medium_size_w', '__return_zero' );
add_filter( 'pre_option_medium_size_h', '__return_zero' );
add_filter( 'pre_option_large_size_w', '__return_zero' );
add_filter( 'pre_option_large_size_h', '__return_zero' );
```

#### 3. **Visual Feedback** (Both Plugins)
- CSS to make settings appear disabled (opacity, pointer-events)
- "Disabled" labels added to setting fields
- Admin notices explaining why settings are disabled

## What These Plugins Do

### Core Functionality (Both Plugins)

1. **Disable WordPress Image Processing:**
   - Prevents WordPress from creating thumbnails, medium, and large sizes
   - Disables WordPress image editors (GD/ImageMagick)
   - Stops automatic thumbnail generation on upload
   - Makes image size settings non-functional

2. **Preserve Original Images:**
   - WordPress stores only the original uploaded image
   - All resizing/optimization handled by Sharp service
   - Metadata preserved but without WordPress-generated sizes

### Full Integration Additional Features

3. **Admin Dashboard Integration:**
   - Service status widget on WordPress dashboard
   - Real-time monitoring with refresh button
   - Processing statistics and error counts
   - Service uptime tracking

4. **Service Health Monitoring:**
   - Automated health checks every 5 minutes via WP Cron
   - Admin notifications when service issues detected
   - Log file analysis for performance metrics
   - Transient caching for efficient status checks

5. **Smart Image Handling:**
   - Automatic detection of Sharp-processed images
   - Responsive image (srcset) generation
   - Fallback to original images when Sharp unavailable
   - Support for standard WordPress image size names

## How It Works

### Image Upload Process
1. User uploads image to WordPress media library
2. WordPress stores only the original image file
3. Sharp service detects new file via file system watcher
4. Sharp automatically generates all required sizes
5. WordPress uses Sharp-generated images when requested

### Image Display Process
1. WordPress theme requests an image size (e.g., 'thumbnail', 'medium')
2. **Full Plugin**: Checks if Sharp-processed version exists and returns it
3. **Simple Plugin**: WordPress uses original image since no sizes exist
4. **Both**: Responsive images work with available Sharp-generated sizes

## Expected File Structure

```
/path/to/wordpress/
├── wp-content/
│   ├── uploads/              # WordPress uploads (monitored by Sharp)
│   │   ├── 2025/01/image.jpg           # Original image
│   │   ├── 2025/01/image-300x200.jpg   # Sharp generated (thumbnail)
│   │   ├── 2025/01/image-150x150.jpg   # Sharp generated (medium)
│   │   ├── 2025/01/image-1024x768.jpg  # Sharp generated (large)
│   │   └── ...
│   └── mu-plugins/
│       └── sharp-image-processing.php  # One of these plugins
└── dev/wp-sharp-image/       # Sharp service directory
    └── logs/
        └── wp-sharp-image.log  # Service logs
```

## Configuration Requirements

### Prerequisites
- Sharp image processing service must be running
- Service configured to monitor WordPress uploads directory  
- WordPress uploads directory writable by Sharp service
- Proper file permissions between WordPress and Sharp service

### Sharp Service Configuration
The Sharp service should be configured to:
- Monitor: `/path/to/wordpress/wp-content/uploads/`
- Generate sizes: 150x150 (thumbnail), 300x300 (medium), 1024x1024 (large)
- Use WordPress-compatible naming: `image-WIDTHxHEIGHT.jpg`

## Troubleshooting

### Common Issues

#### Images Not Displaying Correctly
1. **Check Sharp service status:**
   ```bash
   cd /path/to/dev/wp-sharp-image
   bun run status
   ```

2. **Verify file permissions:**
   ```bash
   ls -la /path/to/wordpress/wp-content/uploads/
   ```

3. **Check if Sharp-generated images exist:**
   ```bash
   find /path/to/wordpress/wp-content/uploads/ -name "*-150x150*"
   ```

#### Settings Still Appear Active
- Clear browser cache
- Check if another plugin is interfering
- Verify mu-plugin is loaded: `WP Admin > Plugins > Must-Use`

#### Service Status Widget Not Working (Full Plugin)
1. Check Sharp service log file location
2. Verify WordPress user can read log files
3. Clear WordPress object cache: `wp cache flush`

### Debug Steps

#### 1. Verify Plugin is Active
```php
// Add to functions.php temporarily
add_action('wp_footer', function() {
    if (is_admin() && current_user_can('manage_options')) {
        echo '<!-- Sharp Integration: ' . (function_exists('tec_disable_wp_image_processing') ? 'Active' : 'Not Active') . ' -->';
    }
});
```

#### 2. Test Image Upload
1. Upload a test image
2. Check uploads directory for original
3. Wait for Sharp service to process (check logs)
4. Verify Sharp-generated sizes exist

#### 3. Check WordPress Image Sizes
```php
// Add to functions.php temporarily
add_action('wp_footer', function() {
    if (is_admin() && current_user_can('manage_options')) {
        $sizes = get_intermediate_image_sizes();
        echo '<!-- Available Image Sizes: ' . implode(', ', $sizes) . ' -->';
    }
});
```

## Performance Impact

### Before Sharp Integration
- PHP GD/ImageMagick processing during uploads
- High CPU usage on image uploads
- Large memory consumption for image processing
- Synchronous processing blocks uploads

### After Sharp Integration  
- No PHP image processing overhead
- Minimal CPU usage during uploads
- Lower memory consumption
- Asynchronous processing via Sharp service
- Faster upload experience

## WordPress Coding Standards Compliance

Both plugins follow WordPress and your specified coding standards:

- ✅ **WordPress PHP Standards**: Proper formatting and structure
- ✅ **Short Array Syntax**: `[]` instead of `array()`
- ✅ **Early Returns**: Reduced cognitive load with early bailouts  
- ✅ **Proper DocBlocks**: `@since TBD` and aligned parameters
- ✅ **TEC Prefixes**: Global functions prefixed with `tec_`
- ✅ **Security**: Capability checks, nonce verification, input sanitization
- ✅ **Proper WordPress Methods**: Using correct filters and actions

## Support and Maintenance

### Monitoring
- **Simple Plugin**: Monitor via Sharp service tools
- **Full Plugin**: Use WordPress dashboard widget + Sharp service tools

### Log Files
- WordPress: `wp-content/debug.log` (if `WP_DEBUG_LOG` enabled)
- Sharp Service: `dev/wp-sharp-image/logs/wp-sharp-image.log`

### Updates
These mu-plugins will be automatically active and don't require updates through WordPress admin. Update by replacing the files.

---

**Important:** These plugins completely disable WordPress's built-in image processing. Ensure the Sharp service is properly configured and running before installing on production sites. 