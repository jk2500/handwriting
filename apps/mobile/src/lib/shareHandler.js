import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { API_BASE_URL } from './utils';

/**
 * Process a shared document URI to make it usable for file operations
 * @param {string} uri - The URI of the shared document
 * @returns {string} - Processed URI that can be used with FileSystem
 */
export const processSharedUri = (uri) => {
  if (Platform.OS === 'ios') {
    // On iOS, some URIs need special handling
    if (uri.startsWith('file://')) {
      return uri;
    } else {
      // Handle content:// or other special URIs
      return uri;
    }
  } else if (Platform.OS === 'android') {
    // On Android, handle content:// URIs
    return uri;
  }
  // Default fallback
  return uri;
};

/**
 * Get file info (name, size, etc.) from a URI
 * @param {string} uri - The URI of the file
 * @returns {Promise<object>} - Object containing file information
 */
export const getFileInfo = async (uri) => {
  try {
    const processedUri = processSharedUri(uri);
    const fileInfo = await FileSystem.getInfoAsync(processedUri);
    
    // Extract filename from URI
    const uriParts = processedUri.split('/');
    const fileName = uriParts[uriParts.length - 1];
    
    return {
      uri: processedUri,
      name: decodeURIComponent(fileName),
      size: fileInfo.size,
      type: fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    };
  } catch (err) {
    console.error('Error getting file info:', err);
    throw err;
  }
};

/**
 * Upload a shared document to the server
 * @param {string} uri - The URI of the shared document
 * @param {string} [description=''] - Optional description for the document
 * @returns {Promise<object>} - Response from the server
 */
export const uploadSharedDocument = async (uri, description = '') => {
  try {
    const fileInfo = await getFileInfo(uri);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', {
      uri: Platform.OS === 'ios' ? fileInfo.uri.replace('file://', '') : fileInfo.uri,
      name: fileInfo.name,
      type: 'application/pdf',
    });
    
    if (description) {
      formData.append('description', description);
    }
    
    // Upload the file
    const response = await fetch(`${API_BASE_URL}/upload/pdf`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Error uploading shared document:', err);
    throw err;
  }
};

/**
 * Parse the initial URL when the app is opened via a shared document
 * @returns {Promise<string|null>} - Document URI if available, null otherwise
 */
export const getInitialSharedDocument = async () => {
  try {
    // In Expo Linking v5, getInitialURL returns the URL directly
    const url = await Linking.getInitialURL();
    if (!url) return null;
    
    // Handle file:// URLs directly
    if (url.startsWith('file://')) {
      return url;
    }
    
    // For Expo Linking v5, use parseURL instead of parse
    // Note: parseURL may not exist in all versions, fallback to parse if needed
    const parseFunction = Linking.parseURL || Linking.parse;
    const parsed = parseFunction(url);
    
    // Handle different URL formats depending on the platform and sharing method
    if (parsed.queryParams && parsed.queryParams.url) {
      return parsed.queryParams.url;
    } else if (parsed.path) {
      return parsed.path;
    }
    
    return null;
  } catch (err) {
    console.error('Error parsing initial URL:', err);
    return null;
  }
}; 