import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Appbar, ActivityIndicator, Card } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config';

const EditTexScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { jobId } = route.params || {};
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
  
  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Edit TeX" subtitle={job?.input_pdf_filename} />
      </Appbar.Header>
      
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator animating={true} style={styles.loader} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              <Text>
                This screen will allow editing of the TeX file for job ID: {jobId}
              </Text>
              <Text style={styles.placeholder}>
                Editor functionality will be implemented in a future version.
              </Text>
            </Card.Content>
          </Card>
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
    fontStyle: 'italic',
    color: '#666',
  },
});

export default EditTexScreen; 