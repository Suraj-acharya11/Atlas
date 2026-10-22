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
import { createNotificationRegistrationGuard, registerForPushNotifications, NotificationSetupError } from '../../lib/notifications';
import { colors, styles } from '../../lib/theme';
import { AppScreen } from '../../components/AppScreen';

import type { AiActionProposal, AiActionResultData, AiChatResultData, Mission } from '../../lib/types';
import { formatHumanDateTime } from '../../components/DateTimePickerModal';

type ChatResponse = { ok: true; data: AiChatResultData } | { ok: false; reason: 'AI_UNAVAILABLE' };

type MessageItem =
  | { from: 'you'; text: string }
  | { from: 'atlas'; text: string; action?: AiActionProposal | null; actionStatus?: 'pending' | 'executing' | 'executed' | 'cancelled'; resultText?: string; timetable?: Mission };

export default function AiChat() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<MessageItem>>([]);
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
      const history = messages.slice(-8).map((m) => ({ from: m.from, text: m.text }));
      const result = await apiRequest<ChatResponse>('/api/v1/ai/chat', { method: 'POST', body: { message: text, context: { history } } });
      if (!result.ok) throw new Error('ATLAS AI is unavailable right now.');
      setMessages((items) => [
        ...items,
        {
          from: 'atlas',
          text: result.data.text,
          action: result.data.action,
          actionStatus: result.data.action ? 'pending' : undefined,
        },
      ]);
    } catch (error) {
      const fallback = error instanceof Error && error.message ? error.message : 'ATLAS is unavailable right now. Your existing plan remains authoritative.';
      setMessages((items) => [...items, { from: 'atlas', text: fallback }]);
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const handleConfirmAction = async (msgIndex: number, action: AiActionProposal) => {
    setMessages((items) =>
      items.map((m, idx) => (idx === msgIndex ? { ...m, actionStatus: 'executing' } : m)),
    );
    try {
      const result = await apiRequest<AiActionResultData>('/api/v1/ai/action/execute', {
        method: 'POST',
        body: {
          actionType: action.type,
          parameters: action.parameters,
        },
      });

      // Invalidate and refresh relevant caches
      if (action.type === 'CREATE_TASK') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
          queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
        ]);
      } else if (action.type === 'CREATE_GOAL') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['goals'] }),
          queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
          queryClient.invalidateQueries({ queryKey: ['mission', 'today'] }),
        ]);
      } else if (action.type === 'REQUEST_REPLAN') {
        if (result.timetable) {
          queryClient.setQueryData(['mission', 'today'], result.timetable);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['mission', 'today'], refetchType: 'all' }),
          queryClient.refetchQueries({ queryKey: ['mission', 'today'] }),
          queryClient.invalidateQueries({ queryKey: ['decision', 'current'] }),
        ]);
      }

      // Only show successfully executed after operation and cache update complete
      setMessages((items) =>
        items.map((m, idx) =>
          idx === msgIndex
            ? {
                ...m,
                actionStatus: 'executed',
                resultText: result.text || 'Action completed successfully.',
                timetable: result.timetable,
              }
            : m,
        ),
      );
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Failed to execute action.';
      Alert.alert('Action Failed', errMessage);
      setMessages((items) =>
        items.map((m, idx) =>
          idx === msgIndex
            ? {
                ...m,
                actionStatus: 'pending',
                resultText: `Failed: ${errMessage}`,
              }
            : m,
        ),
      );
    }
  };

  const handleCancelAction = (msgIndex: number) => {
    setMessages((items) =>
      items.map((m, idx) => (idx === msgIndex ? { ...m, actionStatus: 'cancelled' } : m)),
    );
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
        if (error instanceof NotificationSetupError) {
          if (error.code === 'permission-denied') {
            setPushState('denied');
            setPushError('Notification permission was not granted by the device.');
            Alert.alert('Permission Denied', 'Please enable notifications in device settings to receive ATLAS reminders.');
            return;
          }
          if (error.code === 'fcm-unconfigured') {
            setPushState('unsupported');
            setPushError('Android push notifications require native FCM configuration (google-services.json).');
            Alert.alert('Configuration Required', 'Push notifications on Android require Firebase Cloud Messaging credentials in the native build.');
            return;
          }
          if (error.code === 'missing-token') {
            setPushState('error');
            setPushError('Push notification token could not be acquired.');
            Alert.alert('Token Unavailable', 'Unable to acquire a push token on this device.');
            return;
          }
        }
        const message = error instanceof Error ? error.message : 'Notification registration failed.';
        if (message.toLowerCase().includes('firebase') || message.toLowerCase().includes('fcm') || message.toLowerCase().includes('google-services')) {
          setPushState('unsupported');
          setPushError('Android push notifications require native FCM credentials.');
          Alert.alert('Configuration Required', 'Push notifications on Android require Firebase Cloud Messaging configured in the native build.');
        } else if (message.toLowerCase().includes('permission')) {
          setPushState('denied');
          setPushError('Notification permission was denied.');
          Alert.alert('Permission Denied', 'Please grant notification permission in settings.');
        } else {
          setPushState('error');
          setPushError('Notifications could not be enabled.');
          Alert.alert('Notifications Unavailable', 'Unable to configure notifications for this environment.');
        }
      } finally {
        setPushBusy(false);
      }
    });
  };

  return (
    <AppScreen subtitle="SMART AI COMMUNICATOR">
      <Text style={styles.title}>What can I help you with?</Text>
      <Text style={styles.subtitle}>Ask anything. Understand decisions. Share updates.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        {['Why this recommendation?', 'Update my plan', 'Update my context', 'Tell ATLAS something'].map((item) => (
          <Pressable key={item} style={[styles.card, { width: '47%', marginTop: 0 }]} onPress={() => setMessage(item)}>
            <Text style={{ color: colors.violetSoft, fontWeight: '700' }}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.card, { minHeight: 190 }]}>
        {messages.length ? (
          messages.map((item, index) => (
            <View
              key={index}
              style={{
                alignSelf: item.from === 'you' ? 'flex-end' : 'flex-start',
                backgroundColor: item.from === 'you' ? colors.violet : colors.surface2,
                borderRadius: 14,
                padding: 11,
                marginTop: 8,
                maxWidth: item.from === 'atlas' && item.action ? '100%' : '86%',
                width: item.from === 'atlas' && item.action ? '100%' : undefined,
              }}
            >
              <Text style={styles.body}>{item.text}</Text>
              {item.from === 'atlas' && item.action && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 12,
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[styles.label, { color: colors.violetSoft, fontWeight: '700' }]}>
                      {item.action.type === 'CREATE_TASK'
                        ? '📝 New Task Proposal'
                        : item.action.type === 'CREATE_GOAL'
                        ? '🎯 New Goal Proposal'
                        : '🔄 Adjust Today\'s Schedule'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Requires Confirmation</Text>
                  </View>

                  {item.action.type === 'CREATE_TASK' && (
                    <View style={{ gap: 4 }}>
                      <Text style={[styles.body, { fontWeight: '700' }]}>
                        {item.action.parameters.title}
                      </Text>
                      {item.action.parameters.deadline && (
                        <Text style={styles.muted}>
                          📅 Deadline: {formatHumanDateTime(item.action.parameters.deadline)}
                        </Text>
                      )}
                      {item.action.parameters.estimatedDurationMinutes ? (
                        <Text style={styles.muted}>
                          ⏱ Estimated: {item.action.parameters.estimatedDurationMinutes}m
                        </Text>
                      ) : null}
                      {item.action.parameters.priority ? (
                        <Text style={styles.muted}>
                          ⚡ Priority: {item.action.parameters.priority}
                        </Text>
                      ) : null}
                      {item.action.parameters.projectId ? (
                        <Text style={styles.muted}>
                          📁 Project linked
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {item.action.type === 'CREATE_GOAL' && (
                    <View style={{ gap: 4 }}>
                      <Text style={[styles.body, { fontWeight: '700' }]}>
                        {item.action.parameters.title}
                      </Text>
                      {item.action.parameters.description ? (
                        <Text style={styles.muted}>
                          {item.action.parameters.description}
                        </Text>
                      ) : null}
                      {item.action.parameters.targetDate && (
                        <Text style={styles.muted}>
                          🎯 Target: {formatHumanDateTime(item.action.parameters.targetDate)}
                        </Text>
                      )}
                    </View>
                  )}

                  {item.action.type === 'REQUEST_REPLAN' && (
                    <View style={{ gap: 4 }}>
                      <Text style={[styles.body, { fontWeight: '700' }]}>
                        ADJUST TODAY'S SCHEDULE
                      </Text>
                      {item.action.parameters.reason ? (
                        <Text style={styles.muted}>
                          Reason: {item.action.parameters.reason}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {item.actionStatus === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <Pressable
                        style={[styles.button, { flex: 1, backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => handleCancelAction(index)}
                      >
                        <Text style={[styles.buttonText, { color: colors.muted }]}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.button, { flex: 1, backgroundColor: colors.violet }]}
                        onPress={() => handleConfirmAction(index, item.action!)}
                      >
                        <Text style={styles.buttonText}>Confirm</Text>
                      </Pressable>
                    </View>
                  )}

                  {item.actionStatus === 'executing' && (
                    <View style={{ marginTop: 10, padding: 8, alignItems: 'center' }}>
                      <Text style={{ color: colors.violetSoft, fontWeight: '600', fontSize: 13 }}>
                        Recomputing today’s schedule...
                      </Text>
                    </View>
                  )}

                  {item.actionStatus === 'executed' && (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#0d281e', borderRadius: 8, borderColor: colors.green, borderWidth: 1, gap: 8 }}>
                      <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>
                        ✓ {item.resultText || 'Action completed successfully.'}
                      </Text>
                      {item.timetable?.blocks && item.timetable.blocks.length > 0 && (
                        <View style={{ marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(52, 211, 153, 0.2)', gap: 4 }}>
                          <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '600' }}>
                            Updated Schedule ({item.timetable.blocks.length} blocks):
                          </Text>
                          {item.timetable.blocks.slice(0, 4).map((b, bIdx) => (
                            <Text key={b.id || bIdx} style={{ color: colors.text, fontSize: 12 }}>
                              • <Text style={{ color: colors.muted }}>{b.startsAt || '—'}-{b.endsAt || ''}:</Text> {b.title}
                            </Text>
                          ))}
                          <Pressable
                            style={{ marginTop: 6, paddingVertical: 4 }}
                            onPress={() => router.push('/timetable')}>
                            <Text style={{ color: colors.violetSoft, fontSize: 12, fontWeight: '700' }}>
                              View Full Timetable ›
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}

                  {item.actionStatus === 'cancelled' && (
                    <View style={{ marginTop: 10, padding: 8, backgroundColor: colors.surface2, borderRadius: 8 }}>
                      <Text style={{ color: colors.muted, fontSize: 13, fontStyle: 'italic' }}>
                        ✕ Proposal dismissed. No changes were made.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.muted}>Hello. How can I help you today?</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <TextInput
            editable={!sending}
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1, marginTop: 0 }]}
          />
          <Pressable disabled={sending} style={[styles.button, { opacity: sending ? 0.6 : 1 }]} onPress={send}>
            <Text style={styles.buttonText}>{sending ? '…' : '➤'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={[styles.body, { fontWeight: '800' }]}>Upload a document</Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>
          Give ATLAS context from a PDF or TXT document to inform today's planning.
        </Text>
        <Pressable disabled={uploading} style={[styles.button, { marginTop: 14, opacity: uploading ? 0.6 : 1 }]} onPress={upload}>
          <Text style={styles.buttonText}>{uploading ? 'Uploading and processing…' : '⇧  Choose file'}</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={[styles.body, { fontWeight: '800' }]}>Push notifications</Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>
          Status: {pushState === 'registered' ? 'Active (Registered)' : pushState === 'denied' ? 'Permission Denied' : pushState === 'unsupported' ? 'Native Setup Required' : 'Not Configured'}
        </Text>
        {pushError ? <Text style={{ color: colors.violetSoft, marginTop: 6, fontSize: 13 }}>ℹ️ {pushError}</Text> : null}
        <Pressable disabled={pushBusy} style={[styles.button, { marginTop: 14, opacity: pushBusy ? 0.6 : 1 }]} onPress={enablePush}>
          <Text style={styles.buttonText}>{pushBusy ? 'Configuring…' : pushState === 'registered' ? 'Registered' : 'Enable notifications'}</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}
