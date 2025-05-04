import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, TextInput, Text, Snackbar } from 'react-native-paper';
import * as Linking from 'expo-linking';
import { uploadSharedDocument, getInitialSharedDocument, getFileInfo } from '../lib/shareHandler';

const SharedDocumentHandler = ({ onUploadSuccess }) => {
  const [sharedFileUri, setSharedFileUri] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [error, setError] = useState(null);

  // Handle document sharing when the app is already running
  const handleDocumentSharing = async (event) => {
    try {
      const { url } = event;
      if (!url) return;

      // Process the URL to get a usable file URI
      setSharedFileUri(url);
      const info = await getFileInfo(url);
      setFileInfo(info);
      setDialogVisible(true);
    } catch (err) {
      console.error('Error handling shared document:', err);
      setSnackbarMessage(`Error: ${err.message}`);
      setSnackbarVisible(true);
    }
  };

  // Check for shared documents on app launch
  useEffect(() => {
    const checkForSharedDocuments = async () => {
      try {
        const uri = await getInitialSharedDocument();
        if (uri) {
          setSharedFileUri(uri);
          const info = await getFileInfo(uri);
          setFileInfo(info);
          setDialogVisible(true);
        }
      } catch (err) {
        console.error('Error checking for shared documents:', err);
      }
    };

    checkForSharedDocuments();

    // Set up event listener for when app receives a shared document while running
    const linkingSubscription = Linking.addEventListener('url', handleDocumentSharing);

    return () => {
      linkingSubscription.remove();
    };
  }, []);

  const handleUpload = async () => {
    if (!sharedFileUri) {
      setDialogVisible(false);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      await uploadSharedDocument(sharedFileUri, description);
      
      // Success
      setSnackbarMessage('Shared file uploaded successfully!');
      setSnackbarVisible(true);
      setDialogVisible(false);
      setSharedFileUri(null);
      setFileInfo(null);
      setDescription('');
      
      // Call the success callback to refresh jobs
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setDialogVisible(false);
    setSharedFileUri(null);
    setFileInfo(null);
    setDescription('');
    setError(null);
  };

  return (
    <>
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleCancel}>
          <Dialog.Title>Upload Shared Document</Dialog.Title>
          <Dialog.Content>
            {fileInfo && (
              <Text style={styles.fileInfo}>
                {fileInfo.name} ({Math.round(fileInfo.size / 1024)} KB)
              </Text>
            )}
            
            <TextInput
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              disabled={isUploading}
            />
            
            {error && <Text style={styles.errorText}>{error}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancel} disabled={isUploading}>Cancel</Button>
            <Button 
              mode="contained" 
              onPress={handleUpload} 
              loading={isUploading}
              disabled={isUploading}
            >
              Upload
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
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
    </>
  );
};

const styles = StyleSheet.create({
  fileInfo: {
    marginBottom: 15,
    fontSize: 14,
  },
  input: {
    marginBottom: 15,
  },
  errorText: {
    color: 'red',
    marginVertical: 5,
  }
});

export default SharedDocumentHandler; 