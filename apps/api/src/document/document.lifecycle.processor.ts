import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DocumentService } from './document.service';

@Processor('document-lifecycle')
export class DocumentLifecycleProcessor extends WorkerHost {
  constructor(private readonly documents: DocumentService) { super(); }
  async process(_job: Job): Promise<void> { await this.documents.archiveStaleDocuments(); }
}
