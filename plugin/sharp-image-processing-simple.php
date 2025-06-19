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
 * Disable WordPress image processing but keep size definitions
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_disable_wp_image_processing() {
	// Disable image editing.
	add_filter( 'wp_image_editors', '__return_empty_array', 99 );
	
	// Prevent thumbnail generation on upload, but keep size definitions.
	add_filter( 'wp_generate_attachment_metadata', 'sip_prevent_thumbnail_generation', 10, 2 );
	
	// Intercept intermediate size requests to provide Sharp URLs.
	add_filter( 'image_get_intermediate_size', 'sip_get_sharp_intermediate_size', 10, 3 );
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
				'mime-type' => $mime_type,
			];
		}
	}

	return $metadata;
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
function sip_get_sharp_intermediate_size( $data, $attachment_id, $size ) {
	// Only process images.
	$mime_type = get_post_mime_type( $attachment_id );
	if ( strpos( $mime_type, 'image/' ) !== 0 ) {
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
 * Add visual indicators to image size settings
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_add_image_size_indicators() {
	// Add notice on media settings page.
	add_action( 'load-options-media.php', 'sip_add_media_options_notice' );
}

/**
 * Add CSS to indicate Sharp handling of image sizes
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_add_image_size_css_indicators() {
	$screen = get_current_screen();
	if ( ! $screen || 'options-media' !== $screen->id ) {
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
function sip_add_media_options_notice() {
	add_action( 'admin_notices', 'sip_show_media_options_notice' );
}

/**
 * Show notice on media options page
 * 
 * @since TBD
 * 
 * @return void
 */
function sip_show_media_options_notice() {
	echo '<div class="notice notice-info">';
	echo '<p><strong>Sharp Image Processing:</strong> Image size settings are active and define the sizes that will be generated by the Sharp service. WordPress will not generate these sizes - Sharp handles all image processing automatically for better performance.</p>';
	echo '</div>';
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

	// Only show on media and upload pages (but not options-media, handled separately).
	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->id, [ 'upload', 'media', 'attachment' ], true ) ) {
		return;
	}

	echo '<div class="notice notice-info">';
	echo '<p><strong>Sharp Image Processing:</strong> WordPress image processing is disabled. Images are processed by the Sharp service for better performance.</p>';
	echo '</div>';
}

// Initialize all functionality.
add_action( 'init', 'sip_disable_wp_image_processing' );
add_action( 'admin_init', 'sip_add_image_size_indicators' );
add_action( 'admin_head', 'sip_add_image_size_css_indicators' );
add_action( 'admin_notices', 'sip_sharp_admin_notice' ); 