import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from './src/context/AuthContext';
import OnboardingPlatformScreen from './src/screens/Onboardingplatformscreen';

export default function OnboardingPlatformRoute() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.profileStatus === 'platform_linked') {
      router.replace('/onboarding-zone');
      return;
    }

    if (user.profileStatus === 'active') {
      router.replace('/home');
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
        <ActivityIndicator color="#00E5A0" size="large" />
      </View>
    );
  }

  if (user?.profileStatus === 'auth_only') {
    return <OnboardingPlatformScreen />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
      <ActivityIndicator color="#00E5A0" size="large" />
    </View>
  );
}
