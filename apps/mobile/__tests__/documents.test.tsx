import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import AiChat from '../app/(tabs)/ai-chat';
import { DocumentContent } from '../app/document/[id]';
import { apiRequest } from '../lib/api-client';
import { uploadDocument } from '../lib/documents';
import type { DocumentRecord } from '../lib/types';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useLocalSearchParams: jest.fn(() => ({ id: 'document-1' })) }));
jest.mock('../lib/auth-context', () => ({ useAuth: jest.fn(() => ({ token: 'test-token' })) }));
jest.mock('../lib/api-client', () => ({ apiRequest: jest.fn() }));

const DocumentPicker = jest.requireMock('expo-document-picker') as { getDocumentAsync: jest.Mock };
const request = apiRequest as jest.MockedFunction<typeof apiRequest>;
const router = jest.requireMock('expo-router').router as { push: jest.Mock };
const document: DocumentRecord = { _id: 'document-1', filename: 'context.txt', mimeType: 'text/plain', status: 'active', uploadedAt: '2026-08-25T10:00:00.000Z', lastUsedAt: null, pageCount: null, extractedText: 'A useful extracted paragraph.' };

function renderChat() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><AiChat /></QueryClientProvider>);
}

describe('mobile document flow', () => {
  beforeEach(() => {
    request.mockReset();
    DocumentPicker.getDocumentAsync.mockReset();
    router.push.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('handles picker cancellation without uploading', async () => {
    let resolvePicker: (value: { canceled: true; assets: [] }) => void = () => undefined;
    DocumentPicker.getDocumentAsync.mockReturnValueOnce(new Promise((resolve) => { resolvePicker = resolve; }));
    const screen = renderChat();
    fireEvent.press(screen.getByText('⇧  Choose file'));

    expect(await screen.findByText('Uploading and processing…')).toBeTruthy();
    resolvePicker({ canceled: true, assets: [] });
    await waitFor(() => expect(screen.getByText('⇧  Choose file')).toBeTruthy());
    expect(request).not.toHaveBeenCalled();
  });

  it('uploads a supported file, caches the response, and opens its document detail', async () => {
    DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///context.txt', name: 'context.txt', mimeType: 'text/plain' }] });
    request.mockResolvedValueOnce(document);
    const screen = renderChat();
    fireEvent.press(screen.getByText('⇧  Choose file'));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/v1/documents', expect.objectContaining({ method: 'POST', body: expect.any(FormData) })));
    expect(router.push).toHaveBeenCalledWith('/document/document-1');
    expect(await screen.findByText('⇧  Choose file')).toBeTruthy();
  });

  it('surfaces backend upload failures', async () => {
    request.mockRejectedValueOnce(new Error('Document service unavailable'));
    await expect(uploadDocument({ uri: 'file:///context.pdf', name: 'context.pdf', mimeType: 'application/pdf' })).rejects.toThrow('Document service unavailable');
  });

  it('prevents duplicate picker/upload submissions while one upload is pending', async () => {
    let resolve: (value: DocumentRecord) => void = () => undefined;
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///context.txt', name: 'context.txt', mimeType: 'text/plain' }] });
    request.mockReturnValueOnce(new Promise<DocumentRecord>((complete) => { resolve = complete; }));
    const screen = renderChat();
    const button = screen.getByText('⇧  Choose file');
    fireEvent.press(button);
    fireEvent.press(button);

    await waitFor(() => expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledTimes(1);
    resolve(document);
    await waitFor(() => expect(screen.getByText('⇧  Choose file')).toBeTruthy());
  });

  it('renders actual document status and extracted text without inventing WorkAnalysis data', () => {
    const screen = render(<DocumentContent document={document} />);
    expect(screen.getByText('Status: Active')).toBeTruthy();
    expect(screen.getByText('A useful extracted paragraph.')).toBeTruthy();
    expect(screen.getByText('Temporary WorkAnalysis is not included in this document response.')).toBeTruthy();
  });
});
