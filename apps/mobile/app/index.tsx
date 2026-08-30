import { Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { LoadingState } from '../components/ui';
export default function Index(){ const { token, loading } = useAuth(); if (loading) return <View style={{ flex: 1, backgroundColor: '#07070b', justifyContent: 'center' }}><LoadingState /></View>; return <Redirect href={token ? '/(tabs)/dashboard' : '/(auth)/login'} />; }
