import { apiRequest } from './api-client';
import type { DocumentRecord } from './types';

type UploadAsset = { uri: string; name: string; mimeType?: string | null };

export function resolveDocumentMimeType(name: string, mimeType?: string | null) {
  if (mimeType === 'application/pdf' || mimeType === 'text/plain') return mimeType;
  if (mimeType) return null;
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf' as const;
  if (lowerName.endsWith('.txt')) return 'text/plain' as const;
  return null;
}

export async function uploadDocument(asset: UploadAsset) {
  const mimeType = resolveDocumentMimeType(asset.name, asset.mimeType);
  if (!mimeType) throw new Error('Only PDF and TXT files can be uploaded.');
  const form = new FormData();
  form.append('file', { uri: asset.uri, name: asset.name, type: mimeType } as any);
  return apiRequest<DocumentRecord>('/api/v1/documents', { method: 'POST', body: form });
}

export function documentStatusLabel(status: DocumentRecord['status']) {
  switch (status) {
    case 'active': return 'Active';
    case 'referenced': return 'Referenced';
    case 'archived': return 'Archived';
    case 'deleted': return 'Deleted';
  }
}
