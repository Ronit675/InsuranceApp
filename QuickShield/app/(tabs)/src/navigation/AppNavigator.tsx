import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import OnboardingPlatformScreen from '../screens/Onboardingplatformscreen';
import OnboardingZoneScreen from '../screens/Onboardingzonescreen';
import HomeScreen from '../screens/Homescreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
        <ActivityIndicator color="#00E5A0" size="large" />
      </View>
    );
  }

  // Determine starting screen based on profile completion
  const getInitialRoute = () => {
    if (!user) return 'Login';
    if (user.profileStatus === 'auth_only') return 'OnboardingPlatform';
    if (user.profileStatus === 'platform_linked') return 'OnboardingZone';
    return 'Home';
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRoute()}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OnboardingPlatform" component={OnboardingPlatformScreen} />
      <Stack.Screen name="OnboardingZone" component={OnboardingZoneScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}