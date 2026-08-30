import { router, Redirect } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { LoadingState } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { colors, styles } from '../lib/theme';

function SettingRow({ icon, title, description, value, onPress, disabled = false }: { icon: string; title: string; description: string; value?: string; onPress?: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, opacity: disabled ? 0.65 : pressed ? 0.7 : 1 }]}>
    <Text style={{ width: 34, color: colors.violet, fontSize: 22, textAlign: 'center' }}>{icon}</Text>
    <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.body}>{title}</Text><Text style={[styles.muted, { marginTop: 3 }]}>{description}</Text></View>
    {value ? <Text style={{ color: colors.violetSoft, fontSize: 12, marginRight: 10 }}>{value}</Text> : null}<Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
  </Pressable>;
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ marginTop: 22 }}><Text style={styles.label}>{title}</Text><View style={[styles.card, { paddingVertical: 2, marginTop: 9 }]}>{children}</View></View>;
}

export default function Account() {
  const { token, user, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (loading) return <LoadingState />;
  if (!token) return <Redirect href="/(auth)/login" />;
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <View style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={{ color: colors.text, fontSize: 30, paddingRight: 15 }}>‹</Text></Pressable><View><Text style={styles.title}>Profile & Settings</Text><Text style={styles.subtitle}>Manage your account, preferences and data.</Text></View></View>
    <View style={[styles.card, { marginTop: 0 }]}><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 27, fontWeight: '800' }}>{(user?.email?.[0] ?? 'A').toUpperCase()}</Text></View><View style={{ flex: 1, marginLeft: 14 }}><Text style={[styles.title, { fontSize: 19 }]}>{user?.email?.split('@')[0] ?? 'ATLAS User'}</Text><Text style={[styles.muted, { marginTop: 4 }]}>{user?.email ?? 'Authenticated ATLAS user'}</Text><Text style={[styles.muted, { marginTop: 4 }]}>{user?.timezone ?? 'Timezone not provided'}</Text></View></View><View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}><View><Text style={styles.muted}>Session</Text><Text style={[styles.body, { marginTop: 3 }]}>Authenticated</Text></View><View><Text style={styles.muted}>Account</Text><Text style={[styles.body, { marginTop: 3 }]}>ATLAS User</Text></View></View></View>
    <SettingSection title="Account"><SettingRow icon="♙" title="Personal Information" description="View the account details ATLAS currently has" onPress={() => Alert.alert('Personal information', `${user?.email ?? 'Email unavailable'}\n${user?.timezone ?? 'Timezone unavailable'}`)} /><SettingRow icon="▣" title="Change Password" description="Password changes are managed by the authenticated account service" disabled /></SettingSection>
    <SettingSection title="Preferences"><SettingRow icon="✦" title="AI Provider" description="Provider selection and API keys are configured on the backend" value="Backend" onPress={() => Alert.alert('AI provider', 'ATLAS uses the provider configured by the backend. Keep provider credentials in the server environment; never place them in the mobile app.')} /><SettingRow icon="◉" title="Theme" description="The current ATLAS mobile theme" value="Dark" disabled /><SettingRow icon="♧" title="Notifications" description="Manage push permission and device registration" onPress={() => router.push('/(tabs)/ai-chat')} /><SettingRow icon="◎" title="Language" description="The mobile app currently follows the default language" value="English" disabled /><SettingRow icon="◷" title="Time Zone" description="Used when the account is created" value={user?.timezone ?? 'Unavailable'} disabled /></SettingSection>
    <SettingSection title="Data & Privacy"><SettingRow icon="▤" title="Data & Memory" description="ATLAS data remains governed by the backend account" disabled /><SettingRow icon="⇩" title="Export My Data" description="No mobile export endpoint is currently available" disabled /><SettingRow icon="♜" title="Clear Conversation History" description="No conversation-history endpoint is currently available" disabled /></SettingSection>
    <SettingSection title="About"><SettingRow icon="ⓘ" title="About ATLAS" description="ATLAS V1 mobile client" onPress={() => Alert.alert('About ATLAS', 'ATLAS helps organize goals, decisions, execution and reflection. Server responses remain authoritative.')} /><SettingRow icon="?" title="Help & Support" description="Support actions are not configured in this build" disabled /></SettingSection>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 16 }}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} style={[styles.button, { marginTop: 22, backgroundColor: 'transparent', borderColor: colors.red, borderWidth: 1, opacity: busy ? 0.6 : 1 }]} onPress={logout}><Text style={{ color: colors.red, fontWeight: '800' }}>{busy ? 'Signing out…' : 'Sign out'}</Text></Pressable>
  </ScrollView></View>;
}
