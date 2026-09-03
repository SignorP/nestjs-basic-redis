import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Type } from '@nestjs/common';
import { RedisService } from 'src/common/services/redis-basic.service';

export interface SetCacheDto {
    key: string;
    value: any;
    ttlSeconds?: number;
}

export function RedisController<TBase extends Type<RedisService>>(serviceToken: TBase) {
    @Controller()
    abstract class BaseRedisControllerHost {
        constructor(
            @Inject(serviceToken)
            public readonly service: InstanceType<TBase>,
        ) { }

        /**
         * Retrieve value by key. Auto-parses JSON strings if applicable.
         * GET /:key
         */
        @Get(':key')
        async get(@Param('key') key: string) {
            const value = await this.service.get(key);
            if (!value) return null;

            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }

        /**
         * Check if key exists in Redis.
         * GET /exists/:key
         */
        @Get('exists/:key')
        async exists(@Param('key') key: string): Promise<{ exists: boolean }> {
            const isExist = await this.service.exists(key);
            return { exists: isExist };
        }

        /**
         * Set a key-value pair in Redis with optional TTL (in seconds).
         * Automatically handles objects via JSON serialization.
         * POST /
         */
        @Post()
        async set(@Body() body: SetCacheDto) {
            const { key, value, ttlSeconds } = body;

            if (typeof value === 'object' && value !== null) {
                return await this.service.setJson(key, value, ttlSeconds);
            }

            return await this.service.set(key, String(value), ttlSeconds);
        }

        /**
         * Delete a single key from Redis.
         * DELETE /:key
         */
        @Delete(':key')
        async delete(@Param('key') key: string): Promise<{ deleted: boolean; count: number }> {
            const count = await this.service.del(key);
            return { deleted: count > 0, count };
        }

        /**
         * Delete keys matching a glob-style pattern using non-blocking SCAN.
         * DELETE /pattern/clear?match=users:*
         */
        @Delete('pattern/clear')
        async deleteByPattern(@Query('match') pattern: string): Promise<{ deletedCount: number }> {
            if (!pattern) return { deletedCount: 0 };
            const deletedCount = await this.service.deleteByPattern(pattern);
            return { deletedCount };
        }
    }

    return BaseRedisControllerHost;
}
