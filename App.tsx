import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import VendorRegistration from './screens/VendorRegistration';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <VendorRegistration />
    </SafeAreaProvider>
  );
}