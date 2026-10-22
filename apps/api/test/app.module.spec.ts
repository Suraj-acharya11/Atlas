import { Test } from '@nestjs/testing';
import mongoose from 'mongoose';
import { MongooseCoreModule } from '@nestjs/mongoose/dist/mongoose-core.module';
import { AppModule } from '../src/app.module';

jest.mock('ioredis', () => {
  const EventEmitter = require('events');
  class MockRedis extends EventEmitter {
    status = 'ready';
    quit = jest.fn().mockResolvedValue('OK');
    disconnect = jest.fn().mockResolvedValue(undefined);
    duplicate = jest.fn().mockImplementation(() => new MockRedis());
    on = jest.fn().mockReturnThis();
    once = jest.fn().mockReturnThis();
  }
  return {
    __esModule: true,
    default: MockRedis,
    Redis: MockRedis,
  };
});

jest.mock('bullmq', () => {
  const EventEmitter = require('events');
  class MockQueue extends EventEmitter {
    close = jest.fn().mockResolvedValue(undefined);
    disconnect = jest.fn().mockResolvedValue(undefined);
    on = jest.fn().mockReturnThis();
    once = jest.fn().mockReturnThis();
    emit = jest.fn().mockReturnValue(true);
    add = jest.fn().mockResolvedValue({ id: '1' });
  }
  class MockWorker extends EventEmitter {
    close = jest.fn().mockResolvedValue(undefined);
    disconnect = jest.fn().mockResolvedValue(undefined);
    on = jest.fn().mockReturnThis();
    once = jest.fn().mockReturnThis();
    emit = jest.fn().mockReturnValue(true);
  }
  return {
    Queue: MockQueue,
    Worker: MockWorker,
    FlowProducer: jest.fn(),
  };
});

describe('Phase 0 module graph', () => {
  let createConnectionSpy: jest.SpyInstance;

  beforeAll(() => {
    // Prevent live MongoDB network sockets while preserving real Connection instance & schema compiler
    createConnectionSpy = jest.spyOn(MongooseCoreModule as any, 'createMongooseConnection').mockImplementation(async () => {
      const conn = mongoose.createConnection();
      return conn;
    });
  });

  afterAll(async () => {
    createConnectionSpy?.mockRestore();
    await mongoose.disconnect();
  });

  it('compiles without circular-dependency errors', async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(ref).toBeDefined();
    await ref.close();
  }, 30000);
});
