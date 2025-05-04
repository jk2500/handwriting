import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Button, TextInput, Snackbar, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../lib/utils';

const UploadForm = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [error, setError] = useState(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log('User cancelled document picker');
        return;
      }

      const asset = result.assets[0];
      console.log('Document picked:', asset);
      setFile(asset);
      setError(null);
    } catch (err) {
      console.error('Error picking document:', err);
      setError('Error selecting file: ' + err.message);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file first');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const fileUri = file.uri;
      const fileName = file.name;

      // Create form data for the upload
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
        name: fileName,
        type: 'application/pdf',
      });
      
      if (description.trim()) {
        formData.append('description', description.trim());
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

      // Success
      setSnackbarMessage('File uploaded successfully!');
      setSnackbarVisible(true);
      setFile(null);
      setDescription('');
      
      // Call the success callback to refresh jobs
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.fileInfo}>
        {file ? (
          <Text>{file.name} ({Math.round(file.size / 1024)} KB)</Text>
        ) : (
          <Text>No file selected</Text>
        )}
      </View>
      
      <Button 
        mode="outlined" 
        onPress={pickDocument} 
        style={styles.button}
        icon="file-pdf-box"
        disabled={isUploading}
      >
        Select PDF
      </Button>
      
      <TextInput
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        style={styles.input}
        disabled={isUploading}
      />
      
      {error && <Text style={styles.errorText}>{error}</Text>}
      
      <Button 
        mode="contained" 
        onPress={handleUpload} 
        style={styles.button}
        loading={isUploading}
        disabled={!file || isUploading}
        icon="upload"
      >
        {isUploading ? 'Uploading...' : 'Upload PDF'}
      </Button>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  fileInfo: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginVertical: 10,
  },
  errorText: {
    color: 'red',
    marginVertical: 5,
  }
});

export default UploadForm; 