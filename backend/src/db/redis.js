const { createClient } = require('redis');
require('dotenv').config();

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  RESP: 2
});

client.on('error', (err) => console.error('Redis Client Error', err));

client.connect().then(() => {
  console.log('Connected to Redis successfully');
}).catch(err => {
  console.error('Failed to connect to Redis', err);
});

module.exports = client;
