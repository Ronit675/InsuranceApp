import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

type ProfileAvatarProps = {
  uri?: string | null;
  size?: number;
  borderRadius?: number;
};

export default function ProfileAvatar({
  uri,
  size = 58,
  borderRadius = 18,
}: ProfileAvatarProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius }}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius }]}>
      <View style={[styles.head, { width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17 }]} />
      <View style={[styles.body, { width: size * 0.58, height: size * 0.26, borderRadius: size * 0.13 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#F1F3F7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    gap: 5,
  },
  head: {
    backgroundColor: '#9A9A9A',
  },
  body: {
    backgroundColor: '#9A9A9A',
  },
});
