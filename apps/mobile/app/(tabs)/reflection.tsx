import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useReflections } from '../../lib/queries';
import { colors, styles } from '../../lib/theme';
import { AppScreen } from '../../components/AppScreen';
import { QueryState } from '../../components/QueryState';
import type { Reflection } from '../../lib/types';

export function ReflectionSignalCard({ signal }: { signal: Reflection }) {
  return <View style={styles.card}>
    <Text style={styles.body}>Learning signal</Text>
    <Text style={[styles.muted, { marginTop: 7 }]}>{new Date(signal.createdAt).toLocaleString()}</Text>
    <View style={{ marginTop: 16, gap: 8 }}>
      <Text style={styles.muted}>Time estimate: <Text style={styles.body}>{signal.timeEstimate}</Text></Text>
      <Text style={styles.muted}>Difficulty: <Text style={styles.body}>{signal.difficulty}</Text></Text>
      <Text style={styles.muted}>Progress: <Text style={styles.body}>{signal.progress}</Text></Text>
      <Text style={styles.muted}>Plan adherence: <Text style={styles.body}>{signal.planAdherence}</Text></Text>
      <Text style={styles.muted}>Cause: <Text style={styles.body}>{signal.cause || 'unknown'}</Text></Text>
    </View>
  </View>;
}

export function ReflectionIntro() {
  return <View style={[styles.card, { backgroundColor: '#23163d', borderColor: '#5935a1' }]}>
    <Text style={styles.label}>Backend-generated reflection</Text>
    <Text style={[styles.body, { fontSize: 18, fontWeight: '800', marginTop: 10 }]}>Reflection follows execution</Text>
    <Text style={[styles.muted, { marginTop: 6 }]}>ATLAS creates learning signals after a focus execution is completed, marked partial, or abandoned. User-entered reflection text is not supported yet.</Text>
    <Pressable style={[styles.button, { marginTop: 14 }]} onPress={() => router.push('/timetable')}><Text style={styles.buttonText}>Go to Today’s Mission & Focus</Text></Pressable>
  </View>;
}

export default function Reflection() {
  const query = useReflections();
  return <AppScreen><Text style={styles.title}>Reflection</Text><Text style={styles.subtitle}>Learning signals from your execution outcomes.</Text><ReflectionIntro /><QueryState query={query}>{(signals) => <><Text style={[styles.body, { fontWeight: '800', marginTop: 24 }]}>Recent learning signals</Text>{signals.length ? signals.map((signal) => <ReflectionSignalCard signal={signal} key={signal._id} />) : <View style={styles.card}><Text style={styles.muted}>No learning signals recorded yet. Complete or finish a focus execution to generate one.</Text></View>}</>}</QueryState></AppScreen>;
}
