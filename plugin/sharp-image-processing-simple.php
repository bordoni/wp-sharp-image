<?php
/**
 * Sharp Image Processing Integration (Simple Version)
 * 
 * A minimal plugin to disable WordPress image processing and let
 * the Sharp service handle all image generation.
 * 
 * @package    SharpImageProcessing
 * @author     Gustavo Bordoni
 * @license    GPL-2.0+
 * @since      TBD
 * 
 * Plugin Name: Sharp Image Processing (Simple)
 * Description: Minimal integration - disables WordPress image processing to use Sharp service instead.
 * Version: 1.0.0
 * Author: Gustavo Bordoni
 * License: GPL-2.0+
 */

// Prevent direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Disable WordPress image processing completely
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_disable_wp_image_processing() {
	// Remove all intermediate image sizes.
	add_filter( 'intermediate_image_sizes_advanced', '__return_empty_array', 99 );
	
	// Remove default image sizes.
	add_filter( 'intermediate_image_sizes', '__return_empty_array', 99 );
	
	// Disable image editing.
	add_filter( 'wp_image_editors', '__return_empty_array', 99 );
	
	// Prevent thumbnail generation on upload.
	add_filter( 'wp_generate_attachment_metadata', 'sip_prevent_thumbnail_generation', 10, 2 );
}

/**
 * Prevent WordPress from generating thumbnails
 * 
 * @since TBD
 * 
 * @param array $metadata      Attachment metadata.
 * @param int   $attachment_id Attachment ID.
 * 
 * @return array Modified metadata.
 */
function sip_prevent_thumbnail_generation( $metadata, $attachment_id ) {
	// Only process images.
	$mime_type = get_post_mime_type( $attachment_id );
	if ( strpos( $mime_type, 'image/' ) !== 0 ) {
		return $metadata;
	}

	$file = get_attached_file( $attachment_id );
	
	if ( ! $file || ! file_exists( $file ) ) {
		return $metadata;
	}

	// Return basic metadata without sizes.
	$metadata = [
		'file'   => _wp_relative_upload_path( $file ),
		'width'  => 0,
		'height' => 0,
		'sizes'  => [],
	];

	// Get actual image dimensions if possible.
	$image_size = getimagesize( $file );
	if ( $image_size ) {
		$metadata['width']  = $image_size[0];
		$metadata['height'] = $image_size[1];
	}

	return $metadata;
}

/**
 * Disable image size settings with proper WordPress methods
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_disable_image_size_settings() {
	// Override the settings to prevent them from working.
	add_filter( 'pre_option_thumbnail_size_w', '__return_zero' );
	add_filter( 'pre_option_thumbnail_size_h', '__return_zero' );
	add_filter( 'pre_option_thumbnail_crop', '__return_zero' );
	add_filter( 'pre_option_medium_size_w', '__return_zero' );
	add_filter( 'pre_option_medium_size_h', '__return_zero' );
	add_filter( 'pre_option_large_size_w', '__return_zero' );
	add_filter( 'pre_option_large_size_h', '__return_zero' );
}

/**
 * Add CSS to hide image size settings
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_hide_image_size_settings() {
	$screen = get_current_screen();
	if ( ! $screen || 'options-media' !== $screen->id ) {
		return;
	}
	?>
	<style type="text/css">
	.form-table tr:has(th[scope="row"] label[for*="thumbnail_size"]),
	.form-table tr:has(th[scope="row"] label[for*="medium_size"]),
	.form-table tr:has(th[scope="row"] label[for*="large_size"]) {
		opacity: 0.3;
		pointer-events: none;
	}
	.form-table tr th label[for="thumbnail_size_w"]:after,
	.form-table tr th label[for="thumbnail_size_h"]:after,
	.form-table tr th label[for="thumbnail_crop"]:after,
	.form-table tr th label[for="medium_size_w"]:after,
	.form-table tr th label[for="medium_size_h"]:after,
	.form-table tr th label[for="large_size_w"]:after,
	.form-table tr th label[for="large_size_h"]:after {
		content: " (Disabled)";
		color: #dc3232;
		font-style: italic;
	}
	</style>
	<?php
}

/**
 * Show admin notice about Sharp integration
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_sharp_admin_notice() {
	if ( ! is_admin() || ! current_user_can( 'manage_options' ) ) {
		return;
	}

	// Only show on media and upload pages.
	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->id, [ 'upload', 'media', 'attachment', 'options-media' ], true ) ) {
		return;
	}

	echo '<div class="notice notice-info">';
	echo '<p><strong>Sharp Image Processing:</strong> WordPress image processing is disabled. Images are processed by the Sharp service for better performance.</p>';
	echo '</div>';
}

// Initialize all functionality.
add_action( 'init', 'sip_disable_wp_image_processing' );
add_action( 'admin_init', 'sip_disable_image_size_settings' );
add_action( 'admin_head', 'sip_hide_image_size_settings' );
add_action( 'admin_notices', 'sip_sharp_admin_notice' ); 