process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/atlas-test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
process.env.QDRANT_URL = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-jwt-secret';
