import '../global.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { queryClient } from '../lib/query-client';

function QueryBoundary({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  useEffect(() => { queryClient.clear(); }, [queryClient, token]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
export default function RootLayout(){return <AuthProvider><QueryBoundary><Stack screenOptions={{headerShown:false}} /></QueryBoundary></AuthProvider>;}
