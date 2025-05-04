import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ActivityIndicator, Text, Card, DataTable, Button, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

// Import shared libraries/components
import UploadForm from '../components/UploadForm';
import { API_BASE_URL, MAX_RECENT_JOBS } from '../config';
import { formatDate, getButtonVisibility } from '../lib/utils';
import { getStatusDisplayName, getStatusIcon, getStatusColor } from '../lib/statusUtils';

const HomeScreen = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

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

  // Get only the most recent jobs for the home page
  const recentJobs = jobs.slice(0, MAX_RECENT_JOBS);

  const handleCompile = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to trigger compile');
      setTimeout(fetchJobs, 1000); // Refresh list
    } catch (e) {
      console.error("Compile error:", e);
    }
  };

  const handleViewTex = (jobId) => {
    navigation.navigate('EditTex', { jobId });
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
          right={(props) => <Button onPress={handleViewAllJobs}>View All</Button>} 
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
                 const { canSegment, canCompile, canViewTex } = getButtonVisibility(job);
                 const statusIcon = getStatusIcon(job.status);
                 const statusColor = getStatusColor(job.status);
                 
                 return (
                    <DataTable.Row key={job.id}>
                        <DataTable.Cell>
                          <Text numberOfLines={1} ellipsizeMode="middle">
                            {job.input_pdf_filename || 'N/A'}
                          </Text>
                        </DataTable.Cell>
                        <DataTable.Cell>
                          <View style={styles.statusContainer}>
                            <IconButton
                              icon={statusIcon}
                              size={16}
                              iconColor={statusColor}
                              style={styles.statusIcon}
                            />
                            <Text style={{ color: statusColor }}>
                              {getStatusDisplayName(job.status)}
                            </Text>
                          </View>
                        </DataTable.Cell>
                        <DataTable.Cell numeric>
                          <View style={styles.actionsContainer}>
                            {canViewTex && <Button icon="file-document-edit-outline" mode="text" compact onPress={() => handleViewTex(job.id)}>TeX</Button>}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 8,
    elevation: 2,
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    margin: 0,
    marginRight: -4,
  },
});

export default HomeScreen; 