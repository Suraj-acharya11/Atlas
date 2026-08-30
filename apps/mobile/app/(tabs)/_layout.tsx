import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useAuth } from '../../lib/auth-context';
import { BottomTabs } from '../../components/ui';
export default function TabsLayout(){ const { token, loading }=useAuth(); if(!loading&&!token)return <Redirect href="/(auth)/login"/>; return <Tabs screenOptions={{headerShown:false}} tabBar={()=><BottomTabs/>}><Tabs.Screen name="dashboard" options={{title:'Dashboard'}}/><Tabs.Screen name="plan" options={{title:'Plan'}}/><Tabs.Screen name="tasks" options={{title:'Tasks'}}/><Tabs.Screen name="reflection" options={{title:'Reflection'}}/><Tabs.Screen name="ai-chat" options={{title:'AI Chat'}}/></Tabs>; }
