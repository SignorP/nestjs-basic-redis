import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from 'recipes/nestjs-basic-redis/constants/redis.constants';
import { RedisService } from 'src/common/services/redis-basic.service';

@Module({})
export class RedisModule {
    static forRoot(options: RedisOptions & { url?: string }): DynamicModule {
        const redisProvider: Provider = {
            provide: REDIS_CLIENT,
            useFactory: () => {
                if (options.url) return new Redis(options.url, options)
                return new Redis(options)
            }
        }

        return {
            module: RedisModule,
            providers: [redisProvider, RedisService],
            exports: [RedisService, REDIS_CLIENT]
        }
    }
}
