import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import { documentStatusLabel } from '../../lib/documents';
import { colors, styles } from '../../lib/theme';
import { AppScreen } from '../../components/AppScreen';
import { QueryState } from '../../components/QueryState';
import type { DocumentRecord } from '../../lib/types';

export function DocumentContent({ document }: { document: DocumentRecord }) {
  return <View style={styles.card}>
    <Text style={styles.body}>{document.filename}</Text>
    <Text style={[styles.muted, { marginTop: 8 }]}>Status: {documentStatusLabel(document.status)}{document.pageCount !== null ? ` • ${document.pageCount} pages` : ''}</Text>
    <Text style={[styles.muted, { marginTop: 14 }]}>Type: {document.mimeType === 'application/pdf' ? 'PDF' : 'TXT'}</Text>
    {document.extractedText ? <><Text style={[styles.label, { marginTop: 20 }]}>Extracted text</Text><Text style={[styles.body, { marginTop: 8, lineHeight: 22 }]}>{document.extractedText}</Text></> : <Text style={[styles.muted, { marginTop: 20 }]}>Extracted text is not available for this document.</Text>}
    <Text style={[styles.muted, { marginTop: 18 }]}>Temporary WorkAnalysis is not included in this document response.</Text>
    <Text style={{ color: colors.violetSoft, marginTop: 14, fontSize: 12 }}>This document remains separate from permanent Knowledge.</Text>
  </View>;
}

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['document', id], queryFn: () => apiRequest<DocumentRecord>(`/api/v1/documents/${id}`), enabled: Boolean(id) });
  return <AppScreen><Text style={styles.title}>Document</Text><Text style={styles.subtitle}>Current work context, not permanent Knowledge.</Text><QueryState query={query}>{(document) => <DocumentContent document={document} />}</QueryState></AppScreen>;
}
