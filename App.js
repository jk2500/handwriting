import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import AllJobsScreen from './src/screens/AllJobsScreen';
import EditTexScreen from './src/screens/EditTexScreen';
import SegmentScreen from './src/screens/SegmentScreen';

// Import app configuration
import { APP_NAME } from './src/config';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <PaperProvider>
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
          />
          <Stack.Screen 
            name="AllJobs" 
            component={AllJobsScreen}
          />
          <Stack.Screen 
            name="EditTex" 
            component={EditTexScreen}
          />
          <Stack.Screen 
            name="Segment" 
            component={SegmentScreen}
          />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  // Styles removed as they are not used
}); 