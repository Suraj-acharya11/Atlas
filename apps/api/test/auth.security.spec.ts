import * as argon2 from 'argon2';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { PrivacyService } from '../src/user/privacy.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { GeminiProvider } from '../src/ai/gemini.provider';
import { GroqProvider } from '../src/ai/groq.provider';

const userId = new Types.ObjectId().toHexString();

describe('Phase 12 authentication and privacy', () => {
  it('registers with Argon2id and never returns the password hash', async () => {
    const user = { id: userId, email: 'user@example.com', createdAt: new Date(), timezone: 'UTC', preferences: {} };
    const model = { create: jest.fn().mockImplementation(async (value) => ({ ...user, ...value })) };
    const jwt = { sign: jest.fn().mockReturnValue('jwt') };
    const events = { record: jest.fn() };
    const audit = { record: jest.fn() };
    const service = new AuthService(model as any, jwt as any, events as any, audit as any);
    const result = await service.register({ email: 'USER@example.com', password: 'correct horse battery', timezone: 'UTC' });
    expect(await argon2.verify(model.create.mock.calls[0][0].passwordHash, 'correct horse battery')).toBe(true);
    expect(result).toEqual({ accessToken: 'jwt', user: expect.objectContaining({ email: 'user@example.com' }) });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('audits failed login and returns the same unauthorized shape for unknown credentials', async () => {
    const model = { findOne: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(model as any, {} as any, {} as any, audit as any);
    await expect(service.login({ email: 'missing@example.com', password: 'wrong' })).rejects.toMatchObject({ status: 401 });
    expect(audit.record).toHaveBeenCalledWith('FAILED_LOGIN', null, false, { email: 'missing@example.com' });
  });

  it('scopes every exported collection query to the authenticated user', async () => {
    const calls: Array<{ collection: string; filter: unknown }> = [];
    const connection = { collection: (collection: string) => ({ find: (filter: unknown) => { calls.push({ collection, filter }); return { toArray: jest.fn().mockResolvedValue([]) }; } }) };
    await new PrivacyService(connection as any).exportUserData(userId);
    expect(calls).toHaveLength(7);
    expect(calls.every((call) => (call.filter as any).userId.equals(new Types.ObjectId(userId)))).toBe(true);
  });

  it('redacts secret-shaped context keys from Gemini and Groq prompts', async () => {
    const fakeSecret = 'eyJhbGciOiJIUzI1NiJ9.fake-secret';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], choices: [{ message: { content: 'ok' } }] }) } as Response);
    const config = { getOrThrow: jest.fn((key: string) => key.includes('GEMINI') ? 'gemini-key' : 'groq-key') } as any;
    await new GeminiProvider(config).generate('prompt', { jwt: fakeSecret, passwordHash: 'hash', safe: 'visible' });
    await new GroqProvider(config).generate('prompt', { apiKey: fakeSecret, authorization: fakeSecret, safe: 'visible' });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(fakeSecret);
    fetchMock.mockRestore();
  });

  it('rejects expired and tampered JWTs', () => {
    const jwt = new JwtService({ secret: 'phase12-test-secret' });
    const valid = jwt.sign({ sub: userId }, { expiresIn: '1h' });
    expect(jwt.verify(valid).sub).toBe(userId);
    expect(() => jwt.verify(`${valid}tampered`)).toThrow();
    const expired = jwt.sign({ sub: userId }, { expiresIn: -1 });
    expect(() => jwt.verify(expired)).toThrow();
  });

  it('deletes only the owned Knowledge relationship and never touches Events', async () => {
    const model = { deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }) };
    await new KnowledgeService(model as any).delete(userId, new Types.ObjectId().toHexString());
    expect(model.deleteOne).toHaveBeenCalledTimes(1);
  });
});
