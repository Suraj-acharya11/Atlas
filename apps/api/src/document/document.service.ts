import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { DocumentExtractionService } from './document-extraction.service';
import { DocumentRecord, DocumentRecordDocument } from './schemas/document.schema';

export type UploadFile = { originalname: string; mimetype: string; buffer: Buffer };

@Injectable()
export class DocumentService {
  constructor(
    @InjectModel(DocumentRecord.name) private readonly model: Model<DocumentRecordDocument>,
    @InjectQueue('document-lifecycle') private readonly lifecycleQueue: Queue,
    private readonly extraction: DocumentExtractionService,
    private readonly ai: AiService,
    private readonly retrieval: RetrievalService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.lifecycleQueue.add('archive-stale-documents', {}, { repeat: { pattern: '0 2 * * *' }, jobId: 'document-lifecycle-daily' });
  }

  async upload(userId: string, file: UploadFile): Promise<DocumentRecordDocument> {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('User not found');
    const documentId = new Types.ObjectId();
    const storageRoot = path.resolve(this.config.get('DOCUMENT_STORAGE_PATH', path.resolve(process.cwd(), 'storage/documents')));
    const extension = file.mimetype === 'application/pdf' ? '.pdf' : '.txt';
    const storagePath = path.join(storageRoot, `${documentId.toString()}${extension}`);
    await mkdir(storageRoot, { recursive: true });
    await writeFile(storagePath, file.buffer);

    let document: DocumentRecordDocument | undefined;
    try {
      document = await this.model.create({ _id: documentId, userId: new Types.ObjectId(userId), filename: file.originalname, mimeType: file.mimetype, storagePath, status: 'active', uploadedAt: new Date(), lastUsedAt: null, pageCount: null, extractedText: null });
      const extracted = await this.extraction.extract(storagePath, file.mimetype);
      document.extractedText = extracted.text;
      document.pageCount = extracted.pageCount ?? null;
      document.lastUsedAt = new Date();
      await document.save();

      // WorkAnalysis is request/context data only. AiService owns its Redis TTL cache.
      await this.ai.analyzeWork(document.id.toString(), extracted.text, { documentId: document.id.toString(), filename: file.originalname });
      if (this.config.get('DOCUMENT_INDEXING_ENABLED', 'true') !== 'false') await this.indexChunks(userId, document.id.toString(), extracted.text);
      if (!document) throw new InternalServerErrorException('Document was not persisted');
      return document;
    } catch (error) {
      await unlink(storagePath).catch(() => undefined);
      if (document?._id) await this.model.deleteOne({ _id: document._id }).exec().catch(() => undefined);
      if (error instanceof NotFoundException) throw error;
      throw error instanceof Error ? error : new InternalServerErrorException('Document upload failed');
    }
  }

  async findOwned(userId: string, documentId: string): Promise<DocumentRecordDocument> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(documentId)) throw new NotFoundException('Document not found');
    const document = await this.model.findOne({ _id: new Types.ObjectId(documentId), userId: new Types.ObjectId(userId), status: { $ne: 'deleted' } }).exec();
    if (!document) throw new NotFoundException('Document not found');
    document.lastUsedAt = new Date();
    await document.save();
    return document;
  }

  async markDeleted(userId: string, documentId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(documentId)) throw new NotFoundException('Document not found');
    const result = await this.model.updateOne({ _id: new Types.ObjectId(documentId), userId: new Types.ObjectId(userId), status: { $ne: 'deleted' } }, { $set: { status: 'deleted' } }).exec();
    if (!result.matchedCount) throw new NotFoundException('Document not found');
  }

  async archiveStaleDocuments(now = new Date()): Promise<number> {
    const days = Number(this.config.get('DOCUMENT_ARCHIVE_AFTER_DAYS', '90'));
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cursor = this.model.find({ status: 'active', lastUsedAt: { $lt: cutoff } }).sort({ _id: 1 }).cursor();
    let archived = 0;
    for await (const document of cursor) {
      document.status = 'archived';
      await document.save();
      archived += 1;
    }
    return archived;
  }

  private async indexChunks(userId: string, documentId: string, text: string): Promise<void> {
    const chunkSize = 2000;
    for (let offset = 0, index = 0; offset < text.length; offset += chunkSize, index += 1) {
      const chunk = text.slice(offset, offset + chunkSize).trim();
      if (chunk) await this.retrieval.upsert(userId, 'documents', documentId, chunk, `chunk-${index}`);
    }
  }
}
