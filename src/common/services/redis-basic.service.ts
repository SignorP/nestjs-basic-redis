import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'recipes/nestjs-basic-redis/constants/redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

    /**
     * Escape hatch to access the underlying native ioredis instance
     * for advanced operations (e.g., pipelines, transactions, pub/sub).
     */
    get client(): Redis {
        return this.redis;
    }

    /**
     * Sets a string key-value pair in Redis with an optional TTL in seconds.
     *
     * @param key Redis storage key
     * @param value String payload
     * @param ttlSeconds Optional time-to-live in seconds
     */
    async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
        try {
            if (ttlSeconds) return await this.redis.set(key, value, 'EX', ttlSeconds);
            return await this.redis.set(key, value);
        } catch (error) {
            this.logger.error(`Redis SET error for key "${key}":`, error);
            return null;
        }
    }

    /**
     * Retrieves a string value by key.
     * Returns null if the key does not exist or if an error occurs.
     *
     * @param key Redis storage key
     */
    async get(key: string): Promise<string | null> {
        try {
            return await this.redis.get(key);
        } catch (error) {
            this.logger.error(`Redis GET error for key "${key}":`, error);
            return null;
        }
    }

    /**
     * Deletes a key from Redis.
     *
     * @param key Redis storage key
     * @returns The number of keys removed (0 or 1)
     */
    async del(key: string): Promise<number> {
        return await this.redis.del(key);
    }

    /**
     * Checks if a key exists in Redis without fetching its payload.
     *
     * @param key Redis storage key
     */
    async exists(key: string): Promise<boolean> {
        const count = await this.redis.exists(key);
        return count > 0;
    }

    /**
     * Deletes all keys matching a glob-style pattern using non-blocking SCAN iteration.
     * Safe to use in production environments instead of KEYS *.
     *
     * @param pattern Match pattern (e.g., 'users:sessions:*')
     * @returns Total number of deleted keys
     */
    async deleteByPattern(pattern: string): Promise<number> {
        let cursor = '0';
        let deletedCount = 0;

        do {
            const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
            cursor = nextCursor;

            if (keys.length > 0) {
                deletedCount += keys.length;
                await this.redis.del(...keys);
            }
        } while (cursor !== '0');

        return deletedCount;
    }

    /**
     * Serializes an object or primitive value to JSON and stores it in Redis.
     *
     * @param key Redis storage key
     * @param value Payload to serialize
     * @param ttlSeconds Optional time-to-live in seconds
     */
    async setJson(key: string, value: any, ttlSeconds?: number): Promise<'OK' | null> {
        try {
            const stringValue = JSON.stringify(value);
            return await this.set(key, stringValue, ttlSeconds);
        } catch (error) {
            this.logger.error(`Redis setJson stringify error for key "${key}":`, error);
            return null;
        }
    }

    /**
     * Retrieves a stored JSON string and deserializes it back into a strongly typed object.
     * Returns null if key is missing or JSON parsing fails.
     *
     * @param key Redis storage key
     */
    async getJson<T>(key: string): Promise<T | null> {
        const result = await this.get(key);
        if (!result) return null;

        try {
            return JSON.parse(result) as T;
        } catch (error) {
            this.logger.error(`Redis getJson parse error for key "${key}":`, error);
            return null;
        }
    }

    /**
     * Clears all keys from all databases in the current Redis instance.
     * Primary usage: testing environments or database resets.
     */
    async flushAll(): Promise<string> {
        return await this.redis.flushall();
    }

    /**
     * Lifecycle hook executed on module destruction.
     * Gracefully closes the Redis client connection.
     */
    onModuleDestroy() {
        this.redis.quit();
    }
}
