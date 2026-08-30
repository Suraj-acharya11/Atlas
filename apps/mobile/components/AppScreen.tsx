import React from 'react';
import { ScrollView, View } from 'react-native';
import { styles } from '../lib/theme';
import { Header } from './ui';
export function AppScreen({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) { return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Header subtitle={subtitle} />{children}</ScrollView></View>; }
