import { BadRequestException } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { pdfOrTextOnly } from '../src/document/document.controller';
import { DocumentService } from '../src/document/document.service';

const userId = '507f1f77bcf86cd799439011';
const documentId = '507f1f77bcf86cd799439012';

describe('Phase 9 document boundaries', () => {
  const testStorage = path.join(tmpdir(), 'atlas-phase9-test-document-storage');

  afterAll(async () => { await rm(testStorage, { recursive: true, force: true }); });

  it('rejects non-PDF and non-text MIME types before service processing', () => {
    const callback = jest.fn();
    pdfOrTextOnly({} as any, { mimetype: 'image/png' }, callback);
    expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
  });

  it('accepts only PDF and plain text MIME types', () => {
    const callback = jest.fn();
    pdfOrTextOnly({} as any, { mimetype: 'application/pdf' }, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
    callback.mockClear();
    pdfOrTextOnly({} as any, { mimetype: 'text/plain' }, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('persists, analyzes, and indexes a document without writing Knowledge', async () => {
    const saved = { id: documentId, _id: documentId, save: jest.fn().mockResolvedValue(undefined), extractedText: null, pageCount: null, lastUsedAt: null };
    const model = { create: jest.fn().mockResolvedValue(saved), deleteOne: jest.fn() };
    const extraction = { extract: jest.fn().mockResolvedValue({ text: 'PDF content', pageCount: 2 }) };
    const ai = { analyzeWork: jest.fn().mockResolvedValue({ ok: true, data: { subject: 'PDF content' } }) };
    const retrieval = { upsert: jest.fn().mockResolvedValue(undefined) };
    const lifecycleQueue = { add: jest.fn() };
    const config = { get: jest.fn((key: string, fallback: string) => key === 'DOCUMENT_STORAGE_PATH' ? testStorage : fallback) };
    const service = new DocumentService(model as any, lifecycleQueue as any, extraction as any, ai as any, retrieval as any, config as any);

    const result = await service.upload(userId, { originalname: 'notes.pdf', mimetype: 'application/pdf', buffer: Buffer.from('pdf') });
    expect(result).toBe(saved);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ userId: expect.anything(), filename: 'notes.pdf', status: 'active' }));
    expect(extraction.extract).toHaveBeenCalled();
    expect(ai.analyzeWork).toHaveBeenCalledWith(documentId, 'PDF content', expect.objectContaining({ documentId }));
    expect(retrieval.upsert).toHaveBeenCalledWith(userId, 'documents', documentId, 'PDF content', 'chunk-0');
    expect(saved.save).toHaveBeenCalled();
    // No KnowledgeService is injected into DocumentService, so upload cannot create Knowledge.
  });

  it('archives only stale active documents using the cursor path', async () => {
    const stale = { status: 'active', save: jest.fn().mockResolvedValue(undefined) };
    const cursor = (async function* () { yield stale; })();
    const model = { find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ cursor: jest.fn().mockReturnValue(cursor) }) }) };
    const config = { get: jest.fn((_key: string, fallback: string) => fallback) };
    const service = new DocumentService(model as any, {} as any, {} as any, {} as any, {} as any, config as any);
    await expect(service.archiveStaleDocuments(new Date('2026-08-23T00:00:00Z'))).resolves.toBe(1);
    expect(stale.status).toBe('archived');
    expect(stale.save).toHaveBeenCalled();
    expect(model.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', lastUsedAt: expect.anything() }));
  });
});
