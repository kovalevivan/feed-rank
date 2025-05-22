# Video Support in FeedRank

This document describes the video handling capabilities implemented in the FeedRank system, which forwards viral posts from VK to Telegram channels.

## Video Handling Features

### 1. Direct Video Uploads

FeedRank now supports direct video uploads to Telegram channels. When a VK post contains a video, the system will:

1. Attempt to extract a direct video URL from the VK API response
2. Download the video file locally (if a direct URL is available)
3. Upload the video directly to Telegram with proper formatting and metadata
4. Clean up temporary files after successful upload

### 2. Multiple Fallback Methods

The system uses a cascading approach with multiple fallback methods:

1. **Direct URL Method**: If the VK API provides a direct video URL (MP4, etc.), the system will send it directly to Telegram.

2. **Download and Upload Method**: If a direct URL is available but can't be sent directly, the system will download the video file and then upload it to Telegram.

3. **VK API Integration**: The system can extract video information using the VK API to get details like title, duration, and thumbnails.

4. **Link Preview Method**: If direct methods fail, the system will send a message with a preview link to the original VK video.

5. **Text Fallback**: As a last resort, the system will send a text message with a link to the VK video.

### 3. Enhanced Video Metadata

Videos are sent with enhanced metadata:

- Video thumbnails
- Video duration information
- Support for streaming (allows users to start playing before the video is fully downloaded)
- Proper formatting with video title and source information
- A movie camera emoji (🎬) for clear visual indication of video content

## Implementation Details

### VK Service Enhancements

The VK service has been enhanced with functions to:

- Extract video IDs from VK video URLs
- Get direct video URLs from the VK API
- Extract the best quality video URL from video data
- Include direct video URLs in attachment metadata

### Telegram Service Enhancements

The Telegram service now includes:

- Support for downloading videos from URLs
- Proper handling of video file uploads
- Enhanced error handling with multiple fallback methods
- Temporary file management for video processing

## Testing

The implementation has been tested with:

- Direct video URL sending
- Video downloading and uploading
- Fallback methods when direct upload fails
- Various video formats and sizes

## Notes on VK API Limitations

The VK API has certain limitations regarding video access:

- The `video.get` method requires specific permissions that may not be available with all API tokens
- Some videos may not have direct URLs available in the API response
- Access to certain videos may be restricted based on user permissions

In these cases, the system will fall back to sending links to the original VK videos. 