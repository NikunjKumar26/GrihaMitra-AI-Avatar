require('dotenv').config();
const Redis = require('ioredis');

async function testRedis() {
  console.log('--- Testing Redis Connection ---');
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT) || 6379;
  
  console.log(`Configured: ${host}:${port}`);

  const redis = new Redis({
    host,
    port,
    maxRetriesPerRequest: null,
    connectTimeout: 5000 // 5 seconds timeout
  });

  redis.on('connect', () => {
    console.log('✔ SUCCESS: Connected to Redis server successfully!');
    redis.disconnect();
    process.exit(0);
  });

  redis.on('error', (err) => {
    console.error('❌ FAILED: Redis connection error:', err.message);
    redis.disconnect();
    process.exit(1);
  });
}

testRedis();
