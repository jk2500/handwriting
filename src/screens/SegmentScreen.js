import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Appbar, ActivityIndicator, Card, Button } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config';

const SegmentScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { jobId } = route.params || {};
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [segmenting, setSegmenting] = useState(false);
  
  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) {
        setError('No job ID provided');
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setJob(data);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(`Failed to fetch job details: ${errorMessage}`);
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobDetails();
  }, [jobId]);
  
  const handleSegment = async () => {
    if (!jobId) return;
    
    setSegmenting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/segment`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Refresh job data
      const updatedJobResponse = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
      if (updatedJobResponse.ok) {
        const updatedData = await updatedJobResponse.json();
        setJob(updatedData);
      }
      
      // Show success message, could use a Snackbar here
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Failed to trigger segmentation: ${errorMessage}`);
      console.error("Segment error:", e);
    } finally {
      setSegmenting(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Segment Document" subtitle={job?.input_pdf_filename} />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator animating={true} style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <Card style={styles.card}>
              <Card.Content>
                <Text>
                  This screen will show PDF previews and allow segmentation for job ID: {jobId}
                </Text>
                <Text style={styles.placeholder}>
                  Interactive segmentation UI will be implemented in a future version.
                </Text>
              </Card.Content>
              <Card.Actions>
                <Button 
                  mode="contained"
                  icon="content-cut"
                  loading={segmenting}
                  disabled={segmenting || job?.status === 'segmented'}
                  onPress={handleSegment}
                >
                  {segmenting ? 'Segmenting...' : 'Auto-Segment Document'}
                </Button>
              </Card.Actions>
            </Card>
            
            {job?.status === 'segmented' && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={{ color: 'green' }}>
                    Segmentation complete! You can now compile the document.
                  </Text>
                </Card.Content>
                <Card.Actions>
                  <Button
                    mode="contained"
                    icon="play-circle-outline"
                    onPress={() => {
                      // Navigate to home or trigger compile
                      navigation.navigate('Home');
                    }}
                  >
                    Return Home
                  </Button>
                </Card.Actions>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  loader: {
    margin: 20,
  },
  errorText: {
    color: 'red',
    margin: 10,
    textAlign: 'center',
  },
  placeholder: {
    marginTop: 20,
    marginBottom: 20,
    fontStyle: 'italic',
    color: '#666',
  },
});

export default SegmentScreen; 