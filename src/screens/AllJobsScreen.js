import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ActivityIndicator, Text, DataTable, Button, Appbar, IconButton, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config';
import { formatDate, getButtonVisibility } from '../lib/utils';
import { getStatusDisplayName, getStatusIcon, getStatusColor } from '../lib/statusUtils';

const AllJobsScreen = () => {
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
      // Sort by creation date (newest first)
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
    // Poll less frequently on this screen
    const intervalId = setInterval(fetchJobs, 30000);
    return () => clearInterval(intervalId);
  }, [fetchJobs]);

  const handleCompile = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/compile`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to trigger compile');
      }
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

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="All Jobs" />
        <Appbar.Action icon="refresh" onPress={fetchJobs} />
      </Appbar.Header>

      <ScrollView>
        <Card style={styles.card}>
          <Card.Content>
            {loading && jobs.length === 0 && (
              <ActivityIndicator animating={true} style={styles.loader} />
            )}
            
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            
            {!loading && !error && jobs.length === 0 && (
              <Text style={styles.emptyText}>No jobs found. Upload a PDF to get started.</Text>
            )}
            
            {!error && jobs.length > 0 && (
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Filename</DataTable.Title>
                  <DataTable.Title>Status</DataTable.Title>
                  <DataTable.Title numeric>Actions</DataTable.Title>
                </DataTable.Header>

                {jobs.map((job) => {
                  const { canSegment, canCompile, canViewTex } = getButtonVisibility(job);
                  const statusIcon = getStatusIcon(job.status);
                  const statusColor = getStatusColor(job.status);
                  
                  return (
                    <DataTable.Row key={job.id}>
                      <DataTable.Cell>
                        <Text style={styles.filename} numberOfLines={1} ellipsizeMode="middle">
                          {job.input_pdf_filename || 'N/A'}
                        </Text>
                        <Text style={styles.date}>
                          {formatDate(job.created_at)} • {job.model_used || 'N/A'}
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
                          {canSegment && <Button icon="content-cut" mode="text" compact onPress={() => handleSegment(job.id)}>Segment</Button>}
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
    </View>
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
  emptyText: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  filename: {
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#666',
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

export default AllJobsScreen; 