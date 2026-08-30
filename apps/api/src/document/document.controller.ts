import { BadRequestException, Controller, Delete, Get, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { DocumentService, UploadFile } from './document.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function pdfOrTextOnly(_request: Request, file: { mimetype: string }, callback: (error: Error | null, acceptFile: boolean) => void): void {
  if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') callback(null, true);
  else callback(new BadRequestException('Only PDF and plain text documents are supported'), false);
}

@Controller('api/v1/documents')
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE }, fileFilter: pdfOrTextOnly }))
  upload(@Req() request: Request, @UploadedFile() file: UploadFile) {
    if (!file) throw new BadRequestException('A PDF or text file is required');
    return this.documents.upload(actingUserId(request), file);
  }

  @Get(':id')
  get(@Req() request: Request, @Param('id') id: string) { return this.documents.findOwned(actingUserId(request), id); }

  @Delete(':id')
  delete(@Req() request: Request, @Param('id') id: string) { return this.documents.markDeleted(actingUserId(request), id); }
}
