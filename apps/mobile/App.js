import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import SegmentScreen from './src/screens/SegmentScreen';
import AllJobsScreen from './src/screens/AllJobsScreen';
import SharedDocumentHandler from './src/components/SharedDocumentHandler';

// API Endpoint Configuration:
// The app uses the backend API endpoints from /api/lib/utils.js:
// - GET /jobs - List all jobs
// - GET /jobs/{job_id}/status - Get job status
// - GET /jobs/{job_id}/pages - Get rendered page images
// - POST /jobs/{job_id}/segmentations - Create segmentation bounding boxes
// - GET /jobs/{job_id}/segmentation-tasks - Get list of segmentation tasks
// - POST /jobs/{job_id}/compile - Trigger final compilation
// - POST /upload/pdf - Upload a PDF and start a new job

// Note: When deployed to production via Vercel, these endpoints might need an /api prefix
// depending on your Vercel configuration

const Stack = createNativeStackNavigator();

// Define the app theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2196F3',
    accent: '#03A9F4',
  },
};

export default function App() {
  const [refreshJobs, setRefreshJobs] = React.useState(0);
  
  const handleUploadSuccess = () => {
    // Increment to trigger a refresh of job lists in screens
    setRefreshJobs(prev => prev + 1);
  };

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            initialParams={{ refreshTrigger: refreshJobs }}
          />
          <Stack.Screen name="Segment" component={SegmentScreen} />
          <Stack.Screen 
            name="AllJobs" 
            component={AllJobsScreen}
            initialParams={{ refreshTrigger: refreshJobs }}
          />
        </Stack.Navigator>
        
        {/* Add the shared document handler component */}
        <SharedDocumentHandler onUploadSuccess={handleUploadSuccess} />
      </NavigationContainer>
      <StatusBar style="auto" />
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  /*
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  */
});
