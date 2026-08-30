import type { ExpoConfig } from 'expo/config';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? '';

export default {
  name: 'ATLAS',
  slug: 'atlas',
  version: '1.0.0',
  scheme: 'atlas',
  userInterfaceStyle: 'dark',
  android: { package: 'com.anonymous.atlasv1' },
  plugins: ['expo-router', 'expo-secure-store', 'expo-notifications'],
  extra: { API_BASE_URL: apiBaseUrl },
} satisfies ExpoConfig;
