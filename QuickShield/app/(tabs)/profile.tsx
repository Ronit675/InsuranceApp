import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from './src/context/AuthContext';
import ProfileScreen from './src/screens/ProfileScreen';

export default function ProfileRoute() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
    }
  }, [isLoading, user]);

  if (isLoading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
        <ActivityIndicator color="#00E5A0" size="large" />
      </View>
    );
  }

  return <ProfileScreen />;
}
