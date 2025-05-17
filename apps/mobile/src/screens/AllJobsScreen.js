import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ActivityIndicator, Text, Card, DataTable, Button, Appbar, IconButton, Searchbar, Menu, Chip } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL, formatDate } from '../lib/utils';
import { getStatusDisplayName, getStatusIcon, getStatusColor } from '../lib/statusUtils';

const AllJobsScreen = () => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get refresh trigger from route params (passed when a document is shared)
  const refreshTrigger = route.params?.refreshTrigger || 0;

  const filterJobs = useCallback(() => {
    let result = [...jobs];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job => 
        (job.input_pdf_filename && job.input_pdf_filename.toLowerCase().includes(query)) ||
        (job.id && job.id.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      result = result.filter(job => job.status === statusFilter);
    }
    
    setFilteredJobs(result);
  }, [jobs, searchQuery, statusFilter]);

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
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);
  
  // Refresh jobs when refreshTrigger changes (when a document is shared)
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchJobs();
    }
  }, [refreshTrigger, fetchJobs]);

  useEffect(() => {
    filterJobs();
  }, [jobs, searchQuery, statusFilter, filterJobs]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter(null);
  };

  const from = page * itemsPerPage;
  const to = Math.min((page + 1) * itemsPerPage, filteredJobs.length);
  const paginatedJobs = filteredJobs.slice(from, to);

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="All Jobs" />
        <Appbar.Action icon="refresh" onPress={onRefresh} disabled={refreshing} />
      </Appbar.Header>

      <View style={styles.filterContainer}>
        <Searchbar
          placeholder="Search by filename or ID"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        <Menu
          visible={filterMenuVisible}
          onDismiss={() => setFilterMenuVisible(false)}
          anchor={
            <Button
              icon="filter-variant"
              mode="outlined"
              onPress={() => setFilterMenuVisible(true)}
              style={styles.filterButton}
            >
              Filter
            </Button>
          }
        >
          <Menu.Item onPress={() => { setStatusFilter('pending'); setFilterMenuVisible(false); }} title="Pending" />
          <Menu.Item onPress={() => { setStatusFilter('uploaded'); setFilterMenuVisible(false); }} title="Uploaded" />
          <Menu.Item onPress={() => { setStatusFilter('completed'); setFilterMenuVisible(false); }} title="Completed" />
          <Menu.Item onPress={() => { setStatusFilter('failed'); setFilterMenuVisible(false); }} title="Failed" />
          <Menu.Item onPress={() => { setStatusFilter(null); setFilterMenuVisible(false); }} title="All Statuses" />
        </Menu>
      </View>

      {statusFilter && (
        <View style={styles.chipContainer}>
          <Chip 
            icon="filter-remove" 
            onClose={handleClearFilters}
            style={{ backgroundColor: getStatusColor(statusFilter) }}
          >
            {getStatusDisplayName(statusFilter)}
          </Chip>
        </View>
      )}

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !refreshing && (
          <View style={styles.centerContent}>
            <ActivityIndicator animating={true} size="large" />
            <Text style={styles.loadingText}>Loading jobs...</Text>
          </View>
        )}
        
        {error && (
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>{error}</Text>
            <Button mode="contained" onPress={fetchJobs} style={styles.retryButton}>
              Retry
            </Button>
          </View>
        )}
        
        {!loading && !error && filteredJobs.length === 0 && (
          <View style={styles.centerContent}>
            <Text>No jobs found.</Text>
            {(searchQuery || statusFilter) && (
              <Button mode="text" onPress={handleClearFilters} style={styles.clearButton}>
                Clear Filters
              </Button>
            )}
          </View>
        )}
        
        {!error && filteredJobs.length > 0 && (
          <Card style={styles.card}>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Filename</DataTable.Title>
                <DataTable.Title>Status</DataTable.Title>
                <DataTable.Title>Created</DataTable.Title>
                <DataTable.Title numeric>Actions</DataTable.Title>
              </DataTable.Header>

              {paginatedJobs.map((job) => {
                return (
                  <DataTable.Row key={job.id}>
                    <DataTable.Cell>{job.input_pdf_filename || 'N/A'}</DataTable.Cell>
                    <DataTable.Cell>
                      <Text style={{ color: getStatusColor(job.status) }}>
                        {getStatusDisplayName(job.status)}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell>{formatDate(job.created_at)}</DataTable.Cell>
                    <DataTable.Cell numeric>
                      <View style={styles.actionsContainer}>
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}

              <DataTable.Pagination
                page={page}
                numberOfPages={Math.ceil(filteredJobs.length / itemsPerPage)}
                onPageChange={setPage}
                label={`${from + 1}-${to} of ${filteredJobs.length}`}
                showFastPaginationControls
                numberOfItemsPerPageList={[5, 10, 20]}
                numberOfItemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
                selectPageDropdownLabel={'Rows per page'}
              />
            </DataTable>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  scrollView: {
    flex: 1,
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
  card: {
    margin: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    marginRight: 8,
  },
  filterButton: {
    minWidth: 100,
  },
  chipContainer: {
    flexDirection: 'row',
    padding: 8,
    paddingTop: 0,
  },
  clearButton: {
    marginTop: 10,
  },
});

export default AllJobsScreen; 