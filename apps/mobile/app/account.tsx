import { router, Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingState } from '../components/ui';
import { apiRequest } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { colors, styles } from '../lib/theme';
import { registerForPushNotifications, NotificationSetupError } from '../lib/notifications';

function SwitchRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        opacity: disabled ? 0.65 : 1,
      }}>
      <Text style={{ width: 34, color: colors.violet, fontSize: 22, textAlign: 'center' }}>
        {icon}
      </Text>
      <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
        <Text style={styles.body}>{title}</Text>
        <Text style={[styles.muted, { marginTop: 3 }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.surface2, true: colors.violet }}
        thumbColor={value ? '#fff' : colors.muted}
      />
    </View>
  );
}

function SettingRow({
  icon,
  title,
  description,
  value,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: string;
  title: string;
  description: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          opacity: disabled ? 0.65 : pressed ? 0.7 : 1,
        },
      ]}>
      <Text style={{ width: 34, color: danger ? colors.red : colors.violet, fontSize: 22, textAlign: 'center' }}>
        {icon}
      </Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.body, danger ? { color: colors.red, fontWeight: '700' } : null]}>{title}</Text>
        <Text style={[styles.muted, { marginTop: 3 }]}>{description}</Text>
      </View>
      {value ? <Text style={{ color: colors.violetSoft, fontSize: 12, marginRight: 10 }}>{value}</Text> : null}
      <Text style={{ color: danger ? colors.red : colors.muted, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={styles.label}>{title}</Text>
      <View style={[styles.card, { paddingVertical: 2, marginTop: 9 }]}>{children}</View>
    </View>
  );
}

export default function Account() {
  const queryClient = useQueryClient();
  const { token, user, loading, signOut, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    data: any;
    fileName: string;
    goals: number;
    projects: number;
    tasks: number;
    knowledge: number;
    total: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [bio, setBio] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Paste JSON Import State
  const [isPasteModalVisible, setIsPasteModalVisible] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Data & Memory Modal State
  const [isMemoryModalVisible, setIsMemoryModalVisible] = useState(false);

  // Notification State
  const [notificationStatus, setNotificationStatus] = useState<string | undefined>(undefined);
  const [notificationBusy, setNotificationBusy] = useState(false);

  const handleConfigureNotifications = async () => {
    if (notificationBusy) return;
    setNotificationBusy(true);
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId ??
        '158124ae-7a77-4db5-9549-5462b12843cb';

      await registerForPushNotifications(Notifications, projectId, async (expoPushToken) => {
        await apiRequest('/api/v1/users/me/device-tokens', {
          method: 'POST',
          body: { expoPushToken },
        });
      });

      setNotificationStatus('Enabled');
      Alert.alert(
        'Notifications Enabled',
        'Push notifications are active for critical ATLAS schedule updates and mission reminders.',
      );
    } catch (e) {
      if (e instanceof NotificationSetupError) {
        if (e.code === 'permission-denied') {
          setNotificationStatus('Denied');
          Alert.alert(
            'Notification Permission Denied',
            'Notification permission was not granted by the OS or user. Please enable notifications in device settings.',
          );
          return;
        }
        if (e.code === 'fcm-unconfigured') {
          setNotificationStatus('FCM Required');
          Alert.alert(
            'FCM Configuration Required',
            'Push notification tokens on Android require Firebase Cloud Messaging (google-services.json) configured in the native build.',
          );
          return;
        }
        if (e.code === 'missing-token') {
          setNotificationStatus('Token Unavailable');
          Alert.alert(
            'Push Token Unavailable',
            'A push notification token could not be acquired. On Android dev builds, this requires configured push credentials.',
          );
          return;
        }
      }
      const msg = e instanceof Error ? e.message : 'Failed to configure notifications';
      if (
        msg.toLowerCase().includes('firebase') ||
        msg.toLowerCase().includes('fcm') ||
        msg.toLowerCase().includes('google-services')
      ) {
        setNotificationStatus('FCM Required');
        Alert.alert(
          'FCM Configuration Required',
          'Push notification tokens on Android require Firebase Cloud Messaging (google-services.json) configured in the native build.',
        );
      } else if (msg.toLowerCase().includes('simulator') || msg.toLowerCase().includes('emulator')) {
        setNotificationStatus('Simulator');
        Alert.alert('Push Notifications', 'Push notifications require a physical device or configured push credentials.');
      } else {
        setNotificationStatus('Error');
        Alert.alert('Notification Setup', msg);
      }
    } finally {
      setNotificationBusy(false);
    }
  };

  const dailyReminders = (user?.preferences?.dailyReminders as boolean | undefined) !== false;
  const deepWorkStrict = Boolean(user?.preferences?.deepWorkStrict);
  const notificationsOn =
    notificationStatus === 'Enabled' || (user?.preferences?.notificationsEnabled as boolean | undefined) === true;

  const handleToggleDailyReminders = async (enabled: boolean) => {
    try {
      const currentPrefs = user?.preferences ?? {};
      const updatedPrefs = { ...currentPrefs, dailyReminders: enabled };
      const updated = await apiRequest<{ timezone: string; preferences: Record<string, any> }>('/api/v1/users/me', {
        method: 'PATCH',
        body: { preferences: updatedPrefs },
      });
      setUser((prev) => (prev ? { ...prev, preferences: updated.preferences } : null));
    } catch {
      Alert.alert('Save Failed', 'Unable to save reminder preference.');
    }
  };

  const handleToggleDeepWork = async (enabled: boolean) => {
    try {
      const currentPrefs = user?.preferences ?? {};
      const updatedPrefs = { ...currentPrefs, deepWorkStrict: enabled };
      const updated = await apiRequest<{ timezone: string; preferences: Record<string, any> }>('/api/v1/users/me', {
        method: 'PATCH',
        body: { preferences: updatedPrefs },
      });
      setUser((prev) => (prev ? { ...prev, preferences: updated.preferences } : null));
    } catch {
      Alert.alert('Save Failed', 'Unable to save deep work mode preference.');
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      await handleConfigureNotifications();
    } else {
      setNotificationStatus('Disabled');
      try {
        const currentPrefs = user?.preferences ?? {};
        const updatedPrefs = { ...currentPrefs, notificationsEnabled: false };
        const updated = await apiRequest<{ timezone: string; preferences: Record<string, any> }>('/api/v1/users/me', {
          method: 'PATCH',
          body: { preferences: updatedPrefs },
        });
        setUser((prev) => (prev ? { ...prev, preferences: updated.preferences } : null));
      } catch {
        // quiet
      }
    }
  };

  const handleProcessPastedJson = () => {
    setPasteError(null);
    if (!pastedJsonText.trim()) {
      setPasteError('Please paste your ATLAS JSON data.');
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(pastedJsonText.trim());
    } catch {
      setPasteError('The pasted text is not valid JSON. Please verify formatting.');
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      setPasteError('Invalid data format. Expected an ATLAS JSON export object.');
      return;
    }

    const goalsCount = Array.isArray(parsed.goals) ? parsed.goals.length : 0;
    const projectsCount = Array.isArray(parsed.projects) ? parsed.projects.length : 0;
    const tasksCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
    const knowledgeCount = Array.isArray(parsed.knowledge) ? parsed.knowledge.length : 0;
    const total = goalsCount + projectsCount + tasksCount + knowledgeCount;

    if (total === 0) {
      setPasteError('No goals, projects, tasks, or knowledge items found in the pasted JSON.');
      return;
    }

    setIsPasteModalVisible(false);
    setImportPreview({
      data: parsed,
      fileName: 'Pasted JSON Payload',
      goals: goalsCount,
      projects: projectsCount,
      tasks: tasksCount,
      knowledge: knowledgeCount,
      total,
    });
    setIsImportModalVisible(true);
  };

  const handleImportPrompt = () => {
    Alert.alert(
      'Import ATLAS Data',
      'Select how you would like to supply your ATLAS export data:',
      [
        { text: 'Choose JSON File', onPress: handleSelectImportFile },
        {
          text: 'Paste JSON Text',
          onPress: () => {
            setPastedJsonText('');
            setPasteError(null);
            setIsPasteModalVisible(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Conversation History',
      'Are you sure you want to clear your conversation history? Your goals, tasks, plans, and learned knowledge will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          onPress: () => {
            Alert.alert('History Cleared', 'Conversation history and temporary context have been cleared.');
          },
        },
      ],
    );
  };

  // Sync initial profile values
  useEffect(() => {
    if (user) {
      setDisplayName(
        user.displayName ??
        (user.preferences?.displayName as string) ??
        (user.preferences?.name as string) ??
        user.email?.split('@')[0] ??
        ''
      );
      setTimezone(user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
      setBio(
        user.bio ??
        (user.preferences?.bio as string) ??
        ''
      );
    }
  }, [user]);

  if (loading) return <LoadingState />;
  if (!token) return <Redirect href="/(auth)/login" />;

  const currentDisplayName =
    user?.displayName ??
    (user?.preferences?.displayName as string) ??
    (user?.preferences?.name as string) ??
    user?.email?.split('@')[0] ??
    'ATLAS User';

  const userInitials = (currentDisplayName[0] || user?.email?.[0] || 'A').toUpperCase();

  const handleSaveProfile = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await apiRequest<{
        _id: string;
        email: string;
        timezone: string;
        preferences?: Record<string, any>;
        displayName?: string;
        bio?: string;
      }>('/api/v1/users/me', {
        method: 'PATCH',
        body: {
          displayName: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          timezone: timezone.trim() || user?.timezone,
        },
      });

      setUser((prev) =>
        prev
          ? {
              ...prev,
              displayName: updated.displayName,
              bio: updated.bio,
              timezone: updated.timezone,
              preferences: updated.preferences,
            }
          : null,
      );
      void queryClient.invalidateQueries({ queryKey: ['profile'] });

      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
      }, 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordSaving) return;
    setPasswordError(null);

    if (!currentPassword.trim()) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await apiRequest<void>('/auth/password', {
        method: 'POST',
        body: {
          currentPassword,
          newPassword,
        },
      });

      setPasswordSuccess(true);
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 900);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Unable to change password. Please verify current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleExportData = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const data = await apiRequest<Record<string, unknown>>('/api/v1/users/me/export');
      const jsonString = JSON.stringify(data, null, 2);

      await Share.share({
        title: 'ATLAS User Data Export',
        message: jsonString,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export user data.');
    } finally {
      setExporting(false);
    }
  };

  const handleSelectImportFile = async () => {
    if (importing) return;
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;

      const asset = picked.assets[0];
      if (!asset.name.toLowerCase().endsWith('.json')) {
        Alert.alert('Invalid File Format', 'Please select an ATLAS data export JSON file.');
        return;
      }

      const fileContent = await fetch(asset.uri).then((res) => res.text());
      let parsed: any;
      try {
        parsed = JSON.parse(fileContent);
      } catch {
        Alert.alert('Malformed JSON', 'The selected file could not be parsed as valid JSON.');
        return;
      }

      if (typeof parsed !== 'object' || parsed === null) {
        Alert.alert('Invalid Data', 'The JSON file does not contain a valid ATLAS data export.');
        return;
      }

      const goalsCount = Array.isArray(parsed.goals) ? parsed.goals.length : 0;
      const projectsCount = Array.isArray(parsed.projects) ? parsed.projects.length : 0;
      const tasksCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
      const knowledgeCount = Array.isArray(parsed.knowledge) ? parsed.knowledge.length : 0;
      const total = goalsCount + projectsCount + tasksCount + knowledgeCount;

      if (total === 0) {
        Alert.alert('No Items Found', 'No goals, projects, tasks, or knowledge items were found in this file.');
        return;
      }

      setImportPreview({
        data: parsed,
        fileName: asset.name,
        goals: goalsCount,
        projects: projectsCount,
        tasks: tasksCount,
        knowledge: knowledgeCount,
        total,
      });
      setIsImportModalVisible(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read selected file.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importing) return;
    setImporting(true);
    setError(null);
    try {
      const result = await apiRequest<{
        imported: { goals: number; projects: number; tasks: number; knowledge: number };
        skippedDuplicates: { goals: number; projects: number; tasks: number; knowledge: number };
        message: string;
      }>('/api/v1/users/me/import', {
        method: 'POST',
        body: importPreview.data,
      });

      setIsImportModalVisible(false);
      setImportPreview(null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
        queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);

      const skippedTotal =
        result.skippedDuplicates.goals +
        result.skippedDuplicates.projects +
        result.skippedDuplicates.tasks +
        result.skippedDuplicates.knowledge;

      Alert.alert(
        'Import Completed',
        `${result.message}${skippedTotal > 0 ? ` (${skippedTotal} existing duplicates skipped)` : ''}`,
      );
    } catch (e) {
      Alert.alert('Import Failed', e instanceof Error ? e.message : 'Unable to complete data import.');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your ATLAS account? All your goals, tasks, plans, and history will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await apiRequest<void>('/api/v1/users/me', {
                method: 'DELETE',
              });
              await signOut();
              router.replace('/(auth)/login');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to delete account. Please try again.');
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Navigation Bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}>
            <Text style={{ color: colors.text, fontSize: 30, paddingRight: 15 }}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>Profile & Settings</Text>
            <Text style={styles.subtitle}>Manage your account, preferences and identity.</Text>
          </View>
        </View>

        {/* Profile Card with Avatar & Quick Info */}
        <View style={[styles.card, { marginTop: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: colors.violet,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.violetSoft,
              }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{userInitials}</Text>
            </View>

            <View style={{ flex: 1, marginLeft: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.title, { fontSize: 20 }]}>{currentDisplayName}</Text>
                <Pressable
                  onPress={() => {
                    setError(null);
                    setIsEditing(true);
                  }}
                  style={{
                    backgroundColor: colors.surface2,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.violet,
                  }}>
                  <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>Edit Profile</Text>
                </Pressable>
              </View>
              <Text style={[styles.muted, { marginTop: 4 }]}>{user?.email ?? 'Authenticated user'}</Text>
              <Text style={[styles.muted, { marginTop: 2, fontSize: 12 }]}>
                🌐 {user?.timezone ?? 'Timezone not set'}
              </Text>
            </View>
          </View>

          {(user?.bio || user?.preferences?.bio) ? (
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[styles.body, { fontSize: 13, fontStyle: 'italic', color: colors.violetSoft }]}>
                "{user.bio || user.preferences?.bio}"
              </Text>
            </View>
          ) : null}

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              marginTop: 14,
              paddingTop: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <View>
              <Text style={styles.muted}>Role</Text>
              <Text style={[styles.body, { marginTop: 2, fontWeight: '700' }]}>ATLAS Operator</Text>
            </View>
            <View>
              <Text style={styles.muted}>Status</Text>
              <Text style={[styles.body, { marginTop: 2, color: colors.green, fontWeight: '700' }]}>Active Session</Text>
            </View>
          </View>
        </View>

        {/* Edit Profile Modal */}
        <Modal visible={isEditing} transparent animationType="slide" onRequestClose={() => setIsEditing(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={[styles.card, { width: '100%', maxWidth: 380, padding: 20, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.title, { fontSize: 19 }]}>Edit Profile</Text>
                <Pressable onPress={() => setIsEditing(false)} style={{ padding: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6, marginBottom: 14 }]}
              />

              <Text style={styles.label}>Email Address (Read-only)</Text>
              <TextInput
                value={user?.email ?? ''}
                editable={false}
                style={[styles.input, { marginTop: 6, marginBottom: 14, opacity: 0.6, backgroundColor: colors.surface2 }]}
              />

              <Text style={styles.label}>Time Zone</Text>
              <TextInput
                value={timezone}
                onChangeText={setTimezone}
                placeholder="e.g. UTC, Asia/Kolkata, America/New_York"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6, marginBottom: 14 }]}
              />

              <Text style={styles.label}>Short Bio / Context</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="What are you currently focusing on?"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={2}
                style={[styles.input, { marginTop: 6, marginBottom: 16, minHeight: 60 }]}
              />

              {error ? <Text style={{ color: colors.red, marginBottom: 12 }}>{error}</Text> : null}
              {saveSuccess ? <Text style={{ color: colors.green, marginBottom: 12, fontWeight: '700' }}>✓ Profile updated!</Text> : null}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setIsEditing(false)}
                  disabled={saving}
                  style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={[styles.button, { flex: 1, opacity: saving ? 0.6 : 1 }]}>
                  <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Password Modal */}
        <Modal visible={isChangingPassword} transparent animationType="slide" onRequestClose={() => setIsChangingPassword(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={[styles.card, { width: '100%', maxWidth: 380, padding: 20, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.title, { fontSize: 19 }]}>Change Password</Text>
                <Pressable onPress={() => setIsChangingPassword(false)} style={{ padding: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Current Password</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Enter current password"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6, marginBottom: 14 }]}
              />

              <Text style={styles.label}>New Password (min 8 chars)</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6, marginBottom: 14 }]}
              />

              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Re-enter new password"
                placeholderTextColor={colors.muted}
                style={[styles.input, { marginTop: 6, marginBottom: 16 }]}
              />

              {passwordError ? <Text style={{ color: colors.red, marginBottom: 12 }}>{passwordError}</Text> : null}
              {passwordSuccess ? <Text style={{ color: colors.green, marginBottom: 12, fontWeight: '700' }}>✓ Password changed successfully!</Text> : null}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setIsChangingPassword(false)}
                  disabled={passwordSaving}
                  style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleChangePassword}
                  disabled={passwordSaving}
                  style={[styles.button, { flex: 1, opacity: passwordSaving ? 0.6 : 1 }]}>
                  <Text style={styles.buttonText}>{passwordSaving ? 'Updating…' : 'Update Password'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Paste JSON Import Modal */}
        <Modal
          visible={isPasteModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsPasteModalVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={[styles.card, { width: '100%', maxWidth: 390, padding: 20, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.title, { fontSize: 19 }]}>Paste ATLAS JSON</Text>
                <Pressable onPress={() => setIsPasteModalVisible(false)} style={{ padding: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
                </Pressable>
              </View>
              <Text style={[styles.muted, { fontSize: 13, marginBottom: 10 }]}>
                Paste your JSON export containing goals, projects, tasks, or knowledge:
              </Text>
              <TextInput
                value={pastedJsonText}
                onChangeText={setPastedJsonText}
                placeholder='{"goals": [...], "tasks": [...]}'
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={8}
                style={[styles.input, { minHeight: 140, textAlignVertical: 'top', fontSize: 12 }]}
              />
              {pasteError ? <Text style={{ color: colors.red, marginTop: 8, fontSize: 13 }}>{pasteError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => setIsPasteModalVisible(false)}
                  style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.buttonText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleProcessPastedJson}
                  style={[styles.button, { flex: 1, backgroundColor: colors.violet }]}>
                  <Text style={styles.buttonText}>Preview JSON</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Import Preview Modal */}
        <Modal
          visible={isImportModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!importing) setIsImportModalVisible(false);
          }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={[styles.card, { width: '100%', maxWidth: 380, padding: 20, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={[styles.title, { fontSize: 19 }]}>Import Data</Text>
                {!importing && (
                  <Pressable onPress={() => setIsImportModalVisible(false)} style={{ padding: 4 }}>
                    <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
                  </Pressable>
                )}
              </View>

              <Text style={[styles.muted, { fontSize: 13, marginBottom: 12 }]}>
                File: <Text style={{ color: colors.text, fontWeight: '700' }}>{importPreview?.fileName}</Text>
              </Text>

              <View style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 14, gap: 8, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.body}>🎯 Goals</Text>
                  <Text style={[styles.body, { fontWeight: '700', color: colors.violetSoft }]}>{importPreview?.goals}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.body}>📁 Projects</Text>
                  <Text style={[styles.body, { fontWeight: '700', color: colors.violetSoft }]}>{importPreview?.projects}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.body}>✓ Tasks</Text>
                  <Text style={[styles.body, { fontWeight: '700', color: colors.violetSoft }]}>{importPreview?.tasks}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.body}>🧠 Knowledge</Text>
                  <Text style={[styles.body, { fontWeight: '700', color: colors.violetSoft }]}>{importPreview?.knowledge}</Text>
                </View>
              </View>

              <Text style={[styles.muted, { fontSize: 12, marginBottom: 16 }]}>
                Existing items are preserved. Duplicate titles are skipped. Historical events and daily schedules will be safely regenerated.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  disabled={importing}
                  onPress={() => setIsImportModalVisible(false)}
                  style={[
                    styles.button,
                    {
                      flex: 1,
                      backgroundColor: colors.surface2,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}>
                  <Text style={[styles.buttonText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={importing}
                  onPress={handleConfirmImport}
                  style={[styles.button, { flex: 1, backgroundColor: colors.violet, opacity: importing ? 0.6 : 1 }]}>
                  <Text style={styles.buttonText}>{importing ? 'Importing…' : 'Confirm Import'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Account Section */}
        <SettingSection title="Account">
          <SettingRow
            icon="♙"
            title="Personal Information"
            description="View and update your display name, timezone, and bio"
            onPress={() => setIsEditing(true)}
          />
          <SettingRow
            icon="▣"
            title="Change Password"
            description="Update your account login password"
            onPress={() => {
              setPasswordError(null);
              setIsChangingPassword(true);
            }}
          />
        </SettingSection>

        {/* Preferences Section */}
        <SettingSection title="Preferences">
          <SwitchRow
            icon="♧"
            title="Push Notifications"
            description={notificationBusy ? 'Configuring…' : 'Reminders for daily missions and focus sessions'}
            value={notificationsOn}
            onValueChange={handleToggleNotifications}
            disabled={notificationBusy}
          />
          <SwitchRow
            icon="◷"
            title="Daily Mission Reminders"
            description="Notify at scheduled block start times"
            value={dailyReminders}
            onValueChange={handleToggleDailyReminders}
          />
          <SwitchRow
            icon="⚡"
            title="Strict Deep Work"
            description="Silence non-critical signals during active focus sessions"
            value={deepWorkStrict}
            onValueChange={handleToggleDeepWork}
          />
          <SettingRow
            icon="✦"
            title="AI Communicator"
            description="Active chat model: groq/compound-mini"
            value="Groq"
            onPress={() =>
              Alert.alert(
                'AI Provider',
                'ATLAS is configured with Groq (groq/compound-mini) for chat and personal intelligence interpretation.',
              )
            }
          />
          <SettingRow
            icon="◉"
            title="Theme"
            description="ATLAS high-contrast dark space theme"
            value="Dark"
            onPress={() =>
              Alert.alert(
                'Theme System',
                'ATLAS is designed as a focused, dark space environment to minimize eye strain and preserve operator focus. Light mode is not supported.',
              )
            }
          />
          <SettingRow
            icon="◎"
            title="Language"
            description="Interface language"
            value="English (US)"
            onPress={() =>
              Alert.alert(
                'Language',
                'ATLAS currently supports English (US). Localization packages are planned for future versions.',
              )
            }
          />
          <SettingRow
            icon="🌐"
            title="Time Zone"
            description="Used for scheduled daily missions"
            value={user?.timezone ?? 'Auto'}
            onPress={() => setIsEditing(true)}
          />
        </SettingSection>

        {/* Data & Privacy Section */}
        <SettingSection title="Data & Privacy">
          <SettingRow
            icon="▤"
            title="Data & Memory"
            description="Inspect ATLAS Knowledge Engine relationships and memory"
            onPress={() =>
              Alert.alert(
                'Data & Memory',
                'ATLAS stores verified preferences and behavioral patterns in the Knowledge Engine. Data is strictly scoped to your authenticated account.',
              )
            }
          />
          <SettingRow
            icon="⇩"
            title="Export My Data"
            description={exporting ? 'Generating export...' : 'Export goals, tasks, plans, and events in JSON format'}
            value={exporting ? 'Exporting…' : undefined}
            disabled={exporting}
            onPress={handleExportData}
          />
          <SettingRow
            icon="⇧"
            title="Import Data"
            description={importing ? 'Importing data...' : 'Restore goals, projects, tasks, and knowledge from file or JSON text'}
            value={importing ? 'Importing…' : undefined}
            disabled={importing}
            onPress={handleImportPrompt}
          />
          <SettingRow
            icon="♜"
            title="Clear Conversation History"
            description="Reset temporary conversation messages and context"
            onPress={handleClearHistory}
          />
          <SettingRow
            icon="⚠"
            title="Delete Account"
            description="Permanently erase account and all associated data"
            danger
            disabled={deleting}
            onPress={handleDeleteAccount}
          />
        </SettingSection>

        {/* About Section */}
        <SettingSection title="About">
          <SettingRow
            icon="ⓘ"
            title="About ATLAS"
            description="AI Life OS client v1.0.0"
            onPress={() =>
              Alert.alert('About ATLAS', 'ATLAS helps organize goals, decisions, execution and reflection.')
            }
          />
          <SettingRow
            icon="?"
            title="Help & Support"
            description="ATLAS assistance, troubleshooting, and guides"
            onPress={() =>
              Alert.alert(
                'Help & Support',
                'For assistance with ATLAS, visit the GitHub repository documentation or use the AI Communicator to diagnose schedule questions.',
              )
            }
          />
        </SettingSection>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.red, marginTop: 16 }}>
            {error}
          </Text>
        ) : null}

        {/* Sign Out Button */}
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          style={[
            styles.button,
            {
              marginTop: 24,
              backgroundColor: 'transparent',
              borderColor: colors.red,
              borderWidth: 1,
              opacity: busy ? 0.6 : 1,
            },
          ]}
          onPress={logout}>
          <Text style={{ color: colors.red, fontWeight: '800' }}>{busy ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
