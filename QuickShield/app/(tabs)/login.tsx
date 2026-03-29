import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';

export default function LoginRoute() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;

    if (user.profileStatus === 'auth_only') {
      router.replace('/onboarding-platform');
      return;
    }

    if (user.profileStatus === 'platform_linked') {
      router.replace('/onboarding-zone');
      return;
    }

    router.replace('/home');
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
        <ActivityIndicator color="#00E5A0" size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
      <ActivityIndicator color="#00E5A0" size="large" />
    </View>
  );
}
