import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

export default function CreatePolicyRoute() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Policy creation coming next</Text>
      <Text style={styles.body}>
        The route is wired up, but the policy purchase flow has not been built yet.
      </Text>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.replace('/home')}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Back to home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0A0A0F',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    height: 52,
    minWidth: 180,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#00E5A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0F',
  },
});
