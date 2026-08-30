import { rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { DocumentExtractionService } from '../src/document/document-extraction.service';

describe('DocumentExtractionService', () => {
  const filePath = path.join(tmpdir(), 'atlas-phase9-text-fixture.txt');

  afterEach(async () => { await rm(filePath, { force: true }); });

  it('reads plain text directly without invoking Python', async () => {
    await writeFile(filePath, 'plain text fixture');
    await expect(new DocumentExtractionService().extract(filePath, 'text/plain')).resolves.toEqual({ text: 'plain text fixture' });
  });
});
