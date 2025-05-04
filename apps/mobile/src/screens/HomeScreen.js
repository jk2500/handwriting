import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ActivityIndicator, Text, Card, DataTable, Button, Snackbar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import UploadForm from '../components/UploadForm';
import { API_BASE_URL, formatDate, getButtonVisibility } from '../lib/utils';
import { getStatusDisplayName, getStatusIcon, getStatusColor } from '../lib/statusUtils';

const HomeScreen = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get the refresh trigger from route params (passed when a document is shared)
  const refreshTrigger = route.params?.refreshTrigger || 0;

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setJobs(data);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`Failed to fetch jobs: ${errorMessage}`);
      console.error("Fetch error:", e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
    const intervalId = setInterval(fetchJobs, 10000); // Poll every 10 seconds
    return () => clearInterval(intervalId);
  }, [fetchJobs]);
  
  // Refresh jobs when refreshTrigger changes (when a document is shared)
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchJobs();
    }
  }, [refreshTrigger, fetchJobs]);

  // Get only the 4 most recent jobs
  const recentJobs = jobs.slice(0, 4);

  const handleCompile = async (jobId) => {
    setSnackbarMessage('Triggering compilation...');
    setSnackbarVisible(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to trigger compile');
      
      setSnackbarMessage('Compilation started successfully');
      setSnackbarVisible(true);
      setTimeout(fetchJobs, 1000); // Refresh list
    } catch (e) {
      console.error("Compile error:", e);
      setSnackbarMessage(`Compile failed: ${e.message}`);
      setSnackbarVisible(true);
    }
  };
  
  const handleSegment = (jobId) => {
    navigation.navigate('Segment', { jobId });
  };
  
  const handleViewAllJobs = () => {
    navigation.navigate('AllJobs');
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="Upload PDF" />
        <Card.Content>
          <UploadForm onUploadSuccess={fetchJobs} />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title 
          title="Recent Jobs" 
          right={() => <Button onPress={handleViewAllJobs}>View All</Button>} 
        />
        <Card.Content>
          {loading && jobs.length === 0 && <ActivityIndicator animating={true} style={styles.loader} />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && recentJobs.length === 0 && <Text>No recent jobs found.</Text>}
          
          {!error && recentJobs.length > 0 && (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Filename</DataTable.Title>
                <DataTable.Title>Status</DataTable.Title>
                <DataTable.Title numeric>Actions</DataTable.Title>
              </DataTable.Header>

              {recentJobs.map((job) => {
                 const { canSegment, canCompile } = getButtonVisibility(job);
                 return (
                    <DataTable.Row key={job.id}>
                        <DataTable.Cell>{job.input_pdf_filename || 'N/A'}</DataTable.Cell>
                        <DataTable.Cell>
                          <Text style={{ color: getStatusColor(job.status) }}>
                            {getStatusDisplayName(job.status)}
                          </Text>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <View style={styles.actionsContainer}>
                            {canSegment && <Button icon="content-cut" mode="text" compact onPress={() => handleSegment(job.id)}>Seg</Button>}
                            {canCompile && <Button icon="play-circle-outline" mode="text" compact onPress={() => handleCompile(job.id)}>Compile</Button>}
                           </View>
                        </DataTable.Cell>
                    </DataTable.Row>
                 );
              })}
            </DataTable>
          )}
        </Card.Content>
      </Card>
      
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 8,
  },
  loader: {
    marginVertical: 20,
  },
  errorText: {
    color: 'red',
    margin: 10,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});

export default HomeScreen; 