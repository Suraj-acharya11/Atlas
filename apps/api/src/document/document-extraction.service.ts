import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export type ExtractedDocument = { text: string; pageCount?: number };

@Injectable()
export class DocumentExtractionService {
  async extract(filePath: string, mimeType: string): Promise<ExtractedDocument> {
    if (mimeType === 'text/plain') return { text: await readFile(filePath, 'utf8') };
    try {
      const localScript = path.resolve(process.cwd(), 'services/doc-extractor/extract.py');
      const workspaceScript = path.resolve(process.cwd(), '../../services/doc-extractor/extract.py');
      const scriptPath = existsSync(localScript) ? localScript : workspaceScript;
      const { stdout } = await execFileAsync('python3', [scriptPath, filePath], { maxBuffer: 20 * 1024 * 1024 });
      const result = JSON.parse(stdout) as Partial<ExtractedDocument>;
      if (typeof result.text !== 'string') throw new Error('Extractor output did not contain text');
      return { text: result.text, pageCount: typeof result.pageCount === 'number' ? result.pageCount : undefined };
    } catch (error) {
      throw new InternalServerErrorException(`Document extraction failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
