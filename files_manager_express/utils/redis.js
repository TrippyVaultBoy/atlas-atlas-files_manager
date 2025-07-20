const { createClient } = require('redis');

class RedisClient {
    constructor() {
        this.client = createClient();

        this.client.on('connect', () => console.log('Redis connected!'));
        this.client.on('error', (err) => console.log('Redis error!', err));
    }

    isAlive() {
        return this.client.isOpen;
    }

    async get(key) {
        try {
            return await this.client.get(key);
        } catch (err) {
            console.error(`Error getting key ${key}:`, err);
            return null;
        }
    }

    async set(key, value, duration) {
        try {
            await this.client.set(key, value, { EX: duration });
        } catch (err) {
            console.error(`Error setting key ${key}:`, err);
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
        } catch (err) {
            console.error(`Error deleting key ${key}:`, err);
        }
    }
}

const redisClient = new RedisClient();
module.exports = redisClient;