import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import React, { useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth-context';
import { apiRequest } from '../../lib/api-client';
import { uploadDocument } from '../../lib/documents';
import { userUpdateMessage, type UserUpdateResponse } from '../../lib/ai-updates';
import { createNotificationRegistrationGuard, registerForPushNotifications } from '../../lib/notifications';
import { colors, styles } from '../../lib/theme';
import { AppScreen } from '../../components/AppScreen';

export default function AiChat() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ from: 'you' | 'atlas'; text: string }>>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pushState, setPushState] = useState<'not_checked' | 'unsupported' | 'denied' | 'registered' | 'error'>('not_checked');
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const uploadInFlight = useRef(false);
  const sendInFlight = useRef(false);
  const pushRegistrationGuard = useRef(createNotificationRegistrationGuard()).current;

  const send = async () => {
    if (!message.trim() || sending || sendInFlight.current) return;
    sendInFlight.current = true;
    const text = message;
    setMessage('');
    setMessages((items) => [...items, { from: 'you', text }]);
    try {
      setSending(true);
      const result = await apiRequest<UserUpdateResponse>('/api/v1/ai/user-update', { method: 'POST', body: { message: text } });
      setMessages((items) => [...items, { from: 'atlas', text: userUpdateMessage(result) }]);
    } catch {
      setMessages((items) => [...items, { from: 'atlas', text: 'ATLAS is unavailable right now. Your existing plan remains authoritative.' }]);
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const upload = async () => {
    if (uploadInFlight.current) return;
    uploadInFlight.current = true;
    setUploading(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) return;
      const document = await uploadDocument(picked.assets[0]);
      queryClient.setQueryData(['document', document._id], document);
      Alert.alert('Uploaded', 'Your document is available for review. It remains separate from permanent Knowledge.');
      router.push(`/document/${document._id}`);
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  };

  const enablePush = async () => {
    if (!token) {
      setPushState('error');
      setPushError('Sign in before registering this device for notifications.');
      return;
    }
    if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') {
      setPushState('unsupported');
      setPushError('Android remote notifications require an ATLAS SDK-52-compatible development build.');
      return;
    }
    await pushRegistrationGuard.run(async () => {
      setPushBusy(true);
      setPushError(null);
      try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        await registerForPushNotifications(Notifications, projectId, (expoPushToken) => apiRequest('/api/v1/users/me/device-tokens', { method: 'POST', body: { expoPushToken } }));
        setPushState('registered');
        Alert.alert('Notifications enabled', 'This device is registered for ATLAS notifications.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Notification registration failed.';
        setPushState(message.includes('permission') ? 'denied' : 'error');
        setPushError(message);
        Alert.alert('Notifications unavailable', message);
      } finally {
        setPushBusy(false);
      }
    });
  };

  return <AppScreen subtitle="SMART AI COMMUNICATOR"><Text style={styles.title}>What can I help you with?</Text><Text style={styles.subtitle}>Ask anything. Understand decisions. Share updates.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>{['Why this recommendation?', 'Update my plan', 'Update my context', 'Tell ATLAS something'].map((item) => <Pressable key={item} style={[styles.card, { width: '47%', marginTop: 0 }]} onPress={() => setMessage(item)}><Text style={{ color: colors.violetSoft, fontWeight: '700' }}>{item}</Text></Pressable>)}</View><View style={[styles.card, { minHeight: 190 }]}>{messages.length ? messages.map((item, index) => <View key={index} style={{ alignSelf: item.from === 'you' ? 'flex-end' : 'flex-start', backgroundColor: item.from === 'you' ? colors.violet : colors.surface2, borderRadius: 14, padding: 11, marginTop: 8, maxWidth: '86%' }}><Text style={styles.body}>{item.text}</Text></View>) : <Text style={styles.muted}>Hello. How can I help you today?</Text>}<View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}><TextInput editable={!sending} value={message} onChangeText={setMessage} placeholder="Type your message…" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, marginTop: 0 }]} /><Pressable disabled={sending} style={[styles.button,{opacity:sending?.6:1}]} onPress={send}><Text style={styles.buttonText}>{sending?'…':'➤'}</Text></Pressable></View></View><View style={styles.card}><Text style={[styles.body, { fontWeight: '800' }]}>Upload a document</Text><Text style={[styles.muted, { marginTop: 6 }]}>Give ATLAS new context from a PDF or TXT file. It stays temporary WorkAnalysis, not Knowledge.</Text><Pressable disabled={uploading} style={[styles.button, { marginTop: 14, opacity: uploading ? 0.6 : 1 }]} onPress={upload}><Text style={styles.buttonText}>{uploading ? 'Uploading and processing…' : '⇧  Choose file'}</Text></Pressable></View><View style={styles.card}><Text style={[styles.body, { fontWeight: '800' }]}>Push notifications</Text><Text style={[styles.muted, { marginTop: 6 }]}>Permission: {pushState === 'registered' ? 'granted' : pushState === 'denied' ? 'denied' : pushState === 'unsupported' ? 'unavailable in this runtime' : 'not checked'}</Text><Text style={[styles.muted, { marginTop: 6 }]}>Device registration: {pushState === 'registered' ? 'registered with ATLAS' : 'not registered'}</Text>{pushError ? <Text style={{ color: colors.red, marginTop: 8 }}>{pushError}</Text> : null}<Pressable disabled={pushBusy} style={[styles.button, { marginTop: 14, opacity: pushBusy ? 0.6 : 1 }]} onPress={enablePush}><Text style={styles.buttonText}>{pushBusy ? 'Registering…' : pushState === 'registered' ? 'Register again' : 'Enable notifications'}</Text></Pressable></View></AppScreen>;
}
