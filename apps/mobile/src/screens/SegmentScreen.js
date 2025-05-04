import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Dimensions } from 'react-native';
import { ActivityIndicator, Text, Button, Appbar, Portal, Dialog, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../lib/utils';

const SegmentScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { jobId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [pdfImage, setPdfImage] = useState(null);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  const fetchJobDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch job details using job status endpoint instead of direct job endpoint
      const statusResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`);
      if (!statusResponse.ok) {
        throw new Error(`Failed to fetch job status: ${statusResponse.status}`);
      }
      const statusData = await statusResponse.json();
      
      // Fetch the job list to get more details
      const jobsResponse = await fetch(`${API_BASE_URL}/jobs`);
      if (!jobsResponse.ok) {
        throw new Error(`Failed to fetch jobs list: ${jobsResponse.status}`);
      }
      const jobsList = await jobsResponse.json();
      
      // Find the current job in the list
      const currentJob = jobsList.find(job => job.id === jobId);
      if (!currentJob) {
        throw new Error(`Job with ID ${jobId} not found in jobs list`);
      }
      
      // Combine status with job details
      const jobData = { 
        ...currentJob,
        status: statusData.status,
        error_message: statusData.error_message
      };
      
      setJobDetails(jobData);
      
      // Get page images if available
      try {
        const pagesResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/pages`);
        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          if (pagesData.pages && pagesData.pages.length > 0) {
            // Use the first page image
            setPdfImage(pagesData.pages[0].image_url);
          }
        }
      } catch (pageErr) {
        console.log("Page images not available:", pageErr);
        // Continue without pages - not a critical error
      }
    } catch (err) {
      console.error("Error fetching job details:", err);
      setError(`Failed to load job: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSegment = async () => {
    setConfirmDialogVisible(false);
    setProcessing(true);
    setError(null);
    
    try {
      // Get segmentation tasks first
      const tasksResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentation-tasks`);
      if (!tasksResponse.ok) {
        throw new Error(`Failed to fetch segmentation tasks: ${tasksResponse.status}`);
      }
      
      const tasksData = await tasksResponse.json();
      
      // Create empty/placeholder segmentations for each task
      const segmentations = tasksData.tasks.map(task => ({
        label: task.placeholder,
        page_number: 1, // Default to first page since we don't have multi-page support in mobile yet
        x: 0.1,         // Default values - these would normally be set by user interaction
        y: 0.1,
        width: 0.8,
        height: 0.8
      }));
      
      // Submit segmentations
      const segmentResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/segmentations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(segmentations),
      });
      
      if (!segmentResponse.ok) {
        throw new Error(`Failed to submit segmentations: ${segmentResponse.status}`);
      }
      
      // Trigger compilation after segmentation
      const compileResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, {
        method: 'POST',
      });
      
      if (!compileResponse.ok) {
        throw new Error(`Failed to trigger compilation: ${compileResponse.status}`);
      }
      
      setSnackbarMessage('Segmentation and compilation successfully started');
      setSnackbarVisible(true);
      
      // Navigate back to home after a short delay
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
      
    } catch (err) {
      console.error("Segmentation error:", err);
      setError(`Failed to start segmentation: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content 
          title={jobDetails?.input_pdf_filename || 'Segment PDF'} 
          subtitle="Segment Document" 
        />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchJobDetails} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.instructions}>
            This will start the segmentation process for your document.
            The system will attempt to identify text regions in your handwritten document.
          </Text>
          
          {pdfImage && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewHeader}>Document Preview:</Text>
              <Image
                source={{ uri: pdfImage }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          )}
          
          <Button
            mode="contained"
            onPress={() => setConfirmDialogVisible(true)}
            style={styles.segmentButton}
            loading={processing}
            disabled={processing}
            icon="scissors-cutting"
          >
            {processing ? 'Processing...' : 'Start Segmentation'}
          </Button>
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={() => setConfirmDialogVisible(false)}>
          <Dialog.Title>Confirm Segmentation</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to segment this document?</Text>
            <Text>This process may take several minutes.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSegment}>Start</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 10,
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  previewContainer: {
    marginVertical: 20,
    width: '100%',
    alignItems: 'center',
  },
  previewHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  previewImage: {
    width: width * 0.9,
    height: width * 1.2, // Assuming typical PDF aspect ratio
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  segmentButton: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
});

export default SegmentScreen; 