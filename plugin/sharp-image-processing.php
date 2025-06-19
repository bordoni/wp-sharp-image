<?php
/**
 * Sharp Image Processing Integration
 * 
 * Disables WordPress built-in image processing and integrates with the
 * Sharp-based image processing service for high-performance image handling.
 * 
 * @package    SharpImageProcessing
 * @author     Gustavo Bordoni
 * @license    GPL-2.0+
 * @since      TBD
 * 
 * Plugin Name: Sharp Image Processing Integration
 * Description: High-performance image processing using Sharp (Node.js) instead of PHP GD/ImageMagick. Automatically disables WordPress image processing and integrates with external Sharp service.
 * Version: 1.0.0
 * Author: Gustavo Bordoni
 * License: GPL-2.0+
 * Network: true
 */

namespace SharpImageProcessing;

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sharp Image Processing Integration Class
 * 
 * @since TBD
 */
class SharpImageProcessing {

	/**
	 * Plugin version
	 * 
	 * @since TBD
	 * 
	 * @var string
	 */
	const VERSION = '1.0.0';

	/**
	 * Service status cache
	 * 
	 * @since TBD
	 * 
	 * @var array
	 */
	private static $service_status = null;

	/**
	 * Initialize the plugin
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function init() {
		// Disable WordPress image processing.
		self::disable_wp_image_processing();
		
		// Add admin integration.
		self::setup_admin_integration();
		
		// Setup service monitoring.
		self::setup_service_monitoring();
		
		// Add custom image handling.
		self::setup_custom_image_handling();
	}

	/**
	 * Disable WordPress built-in image processing
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	private static function disable_wp_image_processing() {
		// Prevent WordPress from generating thumbnails on upload, but keep size definitions.
		add_filter( 'wp_generate_attachment_metadata', [ __CLASS__, 'prevent_thumbnail_generation' ], 10, 2 );
		
		// Disable image editing.
		add_filter( 'wp_image_editors', '__return_empty_array', 99 );
		
		// Add admin notice about Sharp handling.
		add_action( 'admin_init', [ __CLASS__, 'add_image_size_notice' ] );
		
		// Add custom image sizes handling.
		add_filter( 'wp_get_attachment_image_src', [ __CLASS__, 'get_sharp_processed_image' ], 10, 4 );
		
		// Intercept intermediate size requests to provide Sharp URLs.
		add_filter( 'image_get_intermediate_size', [ __CLASS__, 'get_sharp_intermediate_size' ], 10, 3 );
	}

	/**
	 * Prevent WordPress from generating thumbnails but create metadata
	 * 
	 * @since TBD
	 * 
	 * @param array $metadata      Attachment metadata.
	 * @param int   $attachment_id Attachment ID.
	 * 
	 * @return array Modified metadata.
	 */
	public static function prevent_thumbnail_generation( $metadata, $attachment_id ) {
		if ( ! self::is_image_attachment( $attachment_id ) ) {
			return $metadata;
		}

		$file = get_attached_file( $attachment_id );
		
		if ( ! $file || ! file_exists( $file ) ) {
			return $metadata;
		}

		// Get actual image dimensions.
		$image_size = getimagesize( $file );
		if ( ! $image_size ) {
			return $metadata;
		}

		$metadata = [
			'file'   => _wp_relative_upload_path( $file ),
			'width'  => $image_size[0],
			'height' => $image_size[1],
			'sizes'  => [],
		];

		// Create metadata entries for all registered image sizes (but don't generate files).
		$registered_sizes = wp_get_registered_image_subsizes();
		
		foreach ( $registered_sizes as $size_name => $size_data ) {
			if ( empty( $size_data['width'] ) && empty( $size_data['height'] ) ) {
				continue;
			}

			// Calculate dimensions for this size.
			$resized = image_resize_dimensions( 
				$metadata['width'], 
				$metadata['height'], 
				$size_data['width'], 
				$size_data['height'], 
				$size_data['crop'] 
			);

			if ( $resized ) {
				// Create a fake filename that Sharp will generate.
				$path_info = pathinfo( $file );
				$suffix = $resized[4] . 'x' . $resized[5];
				$fake_filename = $path_info['filename'] . '-' . $suffix . '.' . $path_info['extension'];
				
				$metadata['sizes'][ $size_name ] = [
					'file'   => $fake_filename,
					'width'  => $resized[4],
					'height' => $resized[5],
					'mime-type' => get_post_mime_type( $attachment_id ),
				];
			}
		}

		return $metadata;
	}

	/**
	 * Setup admin integration
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	private static function setup_admin_integration() {
		if ( ! is_admin() ) {
			return;
		}

		add_action( 'admin_notices', [ __CLASS__, 'show_admin_notices' ] );
		add_action( 'wp_dashboard_setup', [ __CLASS__, 'add_dashboard_widget' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_admin_assets' ] );
		add_action( 'wp_ajax_sharp_service_status', [ __CLASS__, 'ajax_service_status' ] );
	}

	/**
	 * Setup service monitoring
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	private static function setup_service_monitoring() {
		// Monitor service health every 5 minutes.
		if ( ! wp_next_scheduled( 'sharp_image_service_health_check' ) ) {
			wp_schedule_event( time(), 'sharp_image_5min', 'sharp_image_service_health_check' );
		}

		add_action( 'sharp_image_service_health_check', [ __CLASS__, 'check_service_health' ] );
		
		// Add custom cron schedule.
		add_filter( 'cron_schedules', [ __CLASS__, 'add_cron_schedules' ] );
	}

	/**
	 * Setup custom image handling
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	private static function setup_custom_image_handling() {
		// Handle image size requests.
		add_filter( 'wp_get_attachment_image_src', [ __CLASS__, 'get_sharp_processed_image' ], 10, 4 );
		
		// Add responsive image support.
		add_filter( 'wp_calculate_image_srcset', [ __CLASS__, 'calculate_sharp_srcset' ], 10, 5 );
	}

	/**
	 * Add notice about Sharp image processing
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function add_image_size_notice() {
		// Add notice about Sharp handling on media settings page.
		add_action( 'load-options-media.php', [ __CLASS__, 'add_media_options_notice' ] );
		
		// Add visual indicators with CSS.
		add_action( 'admin_head', [ __CLASS__, 'add_image_size_indicators_css' ] );
	}

	/**
	 * Add visual indicators to image size settings
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function add_image_size_indicators_css() {
		if ( ! self::is_media_settings_page() ) {
			return;
		}
		?>
		<style type="text/css">
		/* Add visual indicators that Sharp is handling these sizes */
		.form-table tr th label[for="thumbnail_size_w"]:after,
		.form-table tr th label[for="thumbnail_size_h"]:after,
		.form-table tr th label[for="thumbnail_crop"]:after,
		.form-table tr th label[for="medium_size_w"]:after,
		.form-table tr th label[for="medium_size_h"]:after,
		.form-table tr th label[for="large_size_w"]:after,
		.form-table tr th label[for="large_size_h"]:after {
			content: " (Generated by Sharp)";
			color: #0073aa;
			font-style: italic;
			font-weight: normal;
		}
		
		/* Add a subtle background to indicate Sharp processing */
		.form-table tr:has(th[scope="row"] label[for*="thumbnail_size"]),
		.form-table tr:has(th[scope="row"] label[for*="medium_size"]),
		.form-table tr:has(th[scope="row"] label[for*="large_size"]) {
			background-color: #f0f8ff;
			border-left: 3px solid #0073aa;
		}
		</style>
		<?php
	}

	/**
	 * Add notice to media options page
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function add_media_options_notice() {
		add_action( 'admin_notices', [ __CLASS__, 'show_media_options_notice' ] );
	}

	/**
	 * Show notice on media options page
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function show_media_options_notice() {
		echo '<div class="notice notice-info">';
		echo '<p><strong>Sharp Image Processing:</strong> Image size settings are active and define the sizes that will be generated by the Sharp service. WordPress will not generate these sizes - Sharp handles all image processing automatically for better performance.</p>';
		echo '</div>';
	}

	/**
	 * Check if we're on the media settings page
	 * 
	 * @since TBD
	 * 
	 * @return bool True if on media settings page.
	 */
	private static function is_media_settings_page() {
		$screen = get_current_screen();
		return $screen && 'options-media' === $screen->id;
	}

	/**
	 * Get Sharp processed intermediate size data
	 * 
	 * @since TBD
	 * 
	 * @param array|false  $data         Array of intermediate image data or false.
	 * @param int          $attachment_id Image attachment ID.
	 * @param string|array $size         Requested image size.
	 * 
	 * @return array|false Modified intermediate size data or false.
	 */
	public static function get_sharp_intermediate_size( $data, $attachment_id, $size ) {
		if ( ! self::is_image_attachment( $attachment_id ) ) {
			return $data;
		}

		// If WordPress already has data, modify it to point to Sharp files.
		if ( ! empty( $data ) && is_array( $data ) ) {
			$file = get_attached_file( $attachment_id );
			if ( ! $file ) {
				return $data;
			}

			$upload_dir = wp_upload_dir();
			$file_dir = dirname( $file );
			$sharp_filename = $data['file'];
			$sharp_path = $file_dir . '/' . $sharp_filename;

			// Update the data to point to Sharp-processed file.
			$data['path'] = str_replace( $upload_dir['basedir'] . '/', '', $sharp_path );
			$data['url'] = str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $sharp_path );

			return $data;
		}

		return $data;
	}

	/**
	 * Get Sharp processed image
	 * 
	 * @since TBD
	 * 
	 * @param array|false  $image         Array of image data, or boolean false if no image is available.
	 * @param int          $attachment_id Image attachment ID.
	 * @param string|array $size          Requested image size.
	 * @param bool         $icon          Whether the image should be treated as an icon.
	 * 
	 * @return array|false Modified image data or false.
	 */
	public static function get_sharp_processed_image( $image, $attachment_id, $size, $icon ) {
		if ( ! self::is_image_attachment( $attachment_id ) || $icon ) {
			return $image;
		}

		$file = get_attached_file( $attachment_id );
		if ( ! $file ) {
			return $image;
		}

		// Parse size parameter.
		$parsed_size = self::parse_image_size( $size );
		if ( ! $parsed_size ) {
			return $image;
		}

		// Check if Sharp processed version exists.
		$sharp_image_path = self::get_sharp_image_path( $file, $parsed_size );
		if ( ! $sharp_image_path || ! file_exists( $sharp_image_path ) ) {
			// Fallback to original image.
			$upload_dir = wp_upload_dir();
			return [
				str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $file ),
				$parsed_size['width'],
				$parsed_size['height'],
				false,
			];
		}

		// Return Sharp processed image.
		$upload_dir = wp_upload_dir();
		return [
			str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $sharp_image_path ),
			$parsed_size['width'],
			$parsed_size['height'],
			true,
		];
	}

	/**
	 * Calculate Sharp processed srcset
	 * 
	 * @since TBD
	 * 
	 * @param array  $sources       Array of image sources.
	 * @param array  $size_array    Array containing width and height values.
	 * @param string $image_src     The 'src' of the image.
	 * @param array  $image_meta    The image metadata.
	 * @param int    $attachment_id Image attachment ID.
	 * 
	 * @return array Modified sources array.
	 */
	public static function calculate_sharp_srcset( $sources, $size_array, $image_src, $image_meta, $attachment_id ) {
		if ( ! self::is_image_attachment( $attachment_id ) ) {
			return $sources;
		}

		$file = get_attached_file( $attachment_id );
		if ( ! $file ) {
			return $sources;
		}

		$sharp_sources = [];
		$upload_dir    = wp_upload_dir();

		// Generate common responsive sizes.
		$responsive_sizes = [ 320, 480, 768, 1024, 1200, 1920 ];

		foreach ( $responsive_sizes as $width ) {
			$size = [
				'width'  => $width,
				'height' => 0, // Auto height.
				'crop'   => false,
			];

			$sharp_image_path = self::get_sharp_image_path( $file, $size );
			if ( $sharp_image_path && file_exists( $sharp_image_path ) ) {
				$sharp_sources[ $width ] = [
					'url'        => str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $sharp_image_path ),
					'descriptor' => 'w',
					'value'      => $width,
				];
			}
		}

		return array_merge( $sources, $sharp_sources );
	}

	/**
	 * Show admin notices
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function show_admin_notices() {
		$status = self::get_service_status();

		if ( ! $status['running'] ) {
			echo '<div class="notice notice-warning is-dismissible">';
			echo '<p><strong>Sharp Image Processing:</strong> Service is not running. Images may not be processed correctly.</p>';
			echo '</div>';
			return;
		}

		if ( $status['errors'] > 0 ) {
			echo '<div class="notice notice-error is-dismissible">';
			echo '<p><strong>Sharp Image Processing:</strong> Service has encountered errors. Check the service logs.</p>';
			echo '</div>';
		}
	}

	/**
	 * Add dashboard widget
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function add_dashboard_widget() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		wp_add_dashboard_widget(
			'sharp_image_processing',
			'Sharp Image Processing',
			[ __CLASS__, 'dashboard_widget_content' ]
		);
	}

	/**
	 * Dashboard widget content
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function dashboard_widget_content() {
		$status = self::get_service_status();
		?>
		<div id="sharp-service-status">
			<p>
				<strong>Status:</strong> 
				<span class="status-<?php echo $status['running'] ? 'running' : 'stopped'; ?>">
					<?php echo $status['running'] ? '✅ Running' : '❌ Stopped'; ?>
				</span>
			</p>
			
			<?php if ( $status['running'] ) : ?>
				<p><strong>Processed Images:</strong> <?php echo number_format( $status['processed'] ); ?></p>
				<p><strong>Errors:</strong> <?php echo number_format( $status['errors'] ); ?></p>
				<p><strong>Uptime:</strong> <?php echo $status['uptime']; ?></p>
			<?php endif; ?>
			
			<p>
				<button type="button" class="button" onclick="refreshSharpStatus()">
					Refresh Status
				</button>
			</p>
		</div>
		
		<style>
		.status-running { color: #46b450; }
		.status-stopped { color: #dc3232; }
		</style>
		
		<script>
		function refreshSharpStatus() {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', ajaxurl);
			xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			xhr.onload = function() {
				if (xhr.status === 200) {
					location.reload();
				}
			};
			xhr.send('action=sharp_service_status&_ajax_nonce=<?php echo wp_create_nonce( 'sharp_service_status' ); ?>');
		}
		</script>
		<?php
	}

	/**
	 * Enqueue admin assets
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function enqueue_admin_assets() {
		// Add any necessary admin CSS/JS here.
	}

	/**
	 * AJAX handler for service status
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function ajax_service_status() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		check_ajax_referer( 'sharp_service_status' );

		// Clear status cache to force refresh.
		self::$service_status = null;
		delete_transient( 'sharp_service_status' );

		wp_send_json_success( self::get_service_status() );
	}

	/**
	 * Check service health
	 * 
	 * @since TBD
	 * 
	 * @return void
	 */
	public static function check_service_health() {
		// Clear status cache.
		self::$service_status = null;
		delete_transient( 'sharp_service_status' );
		
		// Check if service is running.
		$status = self::get_service_status();
		
		// Log if service is down.
		if ( ! $status['running'] ) {
			error_log( 'Sharp Image Processing service is not running' );
		}
	}

	/**
	 * Add custom cron schedules
	 * 
	 * @since TBD
	 * 
	 * @param array $schedules Existing schedules.
	 * 
	 * @return array Modified schedules.
	 */
	public static function add_cron_schedules( $schedules ) {
		$schedules['sharp_image_5min'] = [
			'interval' => 300,
			'display'  => __( 'Every 5 Minutes' ),
		];

		return $schedules;
	}

	/**
	 * Get service status
	 * 
	 * @since TBD
	 * 
	 * @return array Service status information.
	 */
	private static function get_service_status() {
		if ( null !== self::$service_status ) {
			return self::$service_status;
		}

		// Try to get cached status first.
		$cached_status = get_transient( 'sharp_service_status' );
		if ( false !== $cached_status ) {
			self::$service_status = $cached_status;
			return $cached_status;
		}

		// Default status.
		$status = [
			'running'   => false,
			'processed' => 0,
			'errors'    => 0,
			'uptime'    => 'Unknown',
		];

		// Check if service is running by looking for process.
		$process_check = shell_exec( 'pgrep -f "wp-sharp-image\|bun.*index\.js" 2>/dev/null' );
		if ( ! empty( $process_check ) ) {
			$status['running'] = true;
		}

		// Try to read log file for statistics.
		$log_file = WP_CONTENT_DIR . '/../dev/wp-sharp-image/logs/wp-sharp-image.log';
		if ( file_exists( $log_file ) ) {
			$log_content = file_get_contents( $log_file );
			
			// Count processed images.
			$processed_count = substr_count( $log_content, 'Processing completed' );
			$status['processed'] = $processed_count;
			
			// Count errors.
			$error_count = substr_count( $log_content, 'ERROR' );
			$status['errors'] = $error_count;
		}

		// Cache status for 1 minute.
		set_transient( 'sharp_service_status', $status, 60 );
		self::$service_status = $status;

		return $status;
	}

	/**
	 * Check if attachment is an image
	 * 
	 * @since TBD
	 * 
	 * @param int $attachment_id Attachment ID.
	 * 
	 * @return bool True if attachment is an image.
	 */
	private static function is_image_attachment( $attachment_id ) {
		$mime_type = get_post_mime_type( $attachment_id );
		return strpos( $mime_type, 'image/' ) === 0;
	}

	/**
	 * Parse image size parameter
	 * 
	 * @since TBD
	 * 
	 * @param string|array $size Image size.
	 * 
	 * @return array|false Parsed size array or false.
	 */
	private static function parse_image_size( $size ) {
		if ( is_array( $size ) ) {
			return [
				'width'  => (int) $size[0],
				'height' => (int) $size[1],
				'crop'   => false,
			];
		}

		// Handle named sizes.
		$sizes = [
			'thumbnail' => [ 'width' => 150, 'height' => 150, 'crop' => true ],
			'medium'    => [ 'width' => 300, 'height' => 300, 'crop' => false ],
			'large'     => [ 'width' => 1024, 'height' => 1024, 'crop' => false ],
			'full'      => [ 'width' => 0, 'height' => 0, 'crop' => false ],
		];

		if ( isset( $sizes[ $size ] ) ) {
			return $sizes[ $size ];
		}

		return false;
	}

	/**
	 * Get Sharp processed image path
	 * 
	 * @since TBD
	 * 
	 * @param string $original_path Original image path.
	 * @param array  $size          Size parameters.
	 * 
	 * @return string|false Sharp processed image path or false.
	 */
	private static function get_sharp_image_path( $original_path, $size ) {
		if ( ! $size['width'] && ! $size['height'] ) {
			return $original_path; // Full size.
		}

		$pathinfo = pathinfo( $original_path );
		$suffix   = sprintf( '-%dx%d', $size['width'], $size['height'] );
		
		if ( $size['crop'] ) {
			$suffix .= '-cropped';
		}

		return $pathinfo['dirname'] . '/' . $pathinfo['filename'] . $suffix . '.' . $pathinfo['extension'];
	}
}

/**
 * Initialize the plugin
 * 
 * @since TBD
 * 
 * @return void
 */
function sharp_image_processing_init() {
	SharpImageProcessing::init();
}

// Initialize when WordPress is loaded.
add_action( 'init', __NAMESPACE__ . '\sharp_image_processing_init' );

/**
 * Plugin activation
 * 
 * @since TBD
 * 
 * @return void
 */
function sharp_image_processing_activate() {
	// Clear any existing image cache.
	wp_cache_flush();
	
	// Add option to track activation.
	add_option( 'sharp_image_processing_activated', time() );
}

/**
 * Plugin deactivation
 * 
 * @since TBD
 * 
 * @return void
 */
function sharp_image_processing_deactivate() {
	// Clear scheduled events.
	wp_clear_scheduled_hook( 'sharp_image_service_health_check' );
	
	// Clear transients.
	delete_transient( 'sharp_service_status' );
	
	// Clear image cache.
	wp_cache_flush();
}

// Handle activation/deactivation for mu-plugins (they don't have hooks).
if ( ! get_option( 'sharp_image_processing_activated' ) ) {
	sharp_image_processing_activate();
}

// Cleanup function for when mu-plugin is removed.
register_shutdown_function( function() {
	if ( ! file_exists( __FILE__ ) ) {
		sharp_image_processing_deactivate();
	}
} ); 