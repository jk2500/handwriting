import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Card, Text, Snackbar, ActivityIndicator } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { API_BASE_URL } from '../config';

/**
 * Component for selecting and uploading PDF files
 * @param {Object} props - Component props
 * @param {Function} props.onUploadSuccess - Callback function to run after successful upload
 */
const UploadForm = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('info'); // 'info', 'success', 'error'

  /**
   * Show a snackbar message
   * @param {string} message - Message to display
   * @param {string} type - Type of message ('info', 'success', 'error')
   */
  const showSnackbar = (message, type = 'info') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  /**
   * Handle document picker selection
   */
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: 'application/pdf',
          size: asset.size,
        });
      } else {
        console.log('Document picking cancelled');
      }
    } catch (err) {
      console.error('Error picking document:', err);
      showSnackbar('Error selecting document', 'error');
    }
  };

  /**
   * Clear the selected file
   */
  const clearSelection = () => {
    setSelectedFile(null);
  };

  /**
   * Upload the selected PDF file
   */
  const uploadPdf = async () => {
    if (!selectedFile) {
      showSnackbar('Please select a PDF file first', 'error');
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData object
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: 'application/pdf',
      });

      // Upload to API
      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      showSnackbar('Upload successful!', 'success');
      setSelectedFile(null);
      
      // Call the success callback with the new job data
      if (onUploadSuccess && typeof onUploadSuccess === 'function') {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Upload error:', error);
      showSnackbar(`Upload failed: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.fileInfo}>
        {selectedFile ? (
          <View>
            <Text style={styles.fileInfoText}>
              Selected: {selectedFile.name} 
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </Text>
            <Button 
              mode="text" 
              onPress={clearSelection}
              style={styles.clearButton}
            >
              Clear
            </Button>
          </View>
        ) : (
          <Text style={styles.placeholder}>No file selected</Text>
        )}
      </Card>
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="outlined"
          icon="file-pdf-box"
          onPress={pickDocument}
          style={styles.button}
          disabled={isUploading}
        >
          Select PDF
        </Button>
        
        <Button
          mode="contained"
          icon="cloud-upload"
          onPress={uploadPdf}
          style={styles.button}
          disabled={!selectedFile || isUploading}
          loading={isUploading}
        >
          Upload
        </Button>
      </View>

      {isUploading && (
        <ActivityIndicator 
          animating={true} 
          size="small" 
          style={styles.loader} 
        />
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
        style={
          snackbarType === 'error' 
            ? styles.errorSnackbar 
            : snackbarType === 'success' 
              ? styles.successSnackbar 
              : {}
        }
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  fileInfo: {
    padding: 10,
    marginBottom: 10,
  },
  fileInfoText: {
    marginBottom: 5,
  },
  placeholder: {
    color: '#888',
    textAlign: 'center',
    padding: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  button: {
    margin: 5,
    minWidth: 120,
  },
  clearButton: {
    alignSelf: 'flex-end',
  },
  loader: {
    marginTop: 10,
  },
  errorSnackbar: {
    backgroundColor: '#d32f2f',
  },
  successSnackbar: {
    backgroundColor: '#43a047',
  },
});

export default UploadForm; 