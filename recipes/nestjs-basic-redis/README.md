# NestJS Basic Redis Recipe

A lightweight, robust, and fully customizable Redis integration module for NestJS applications built on top of `ioredis`.

Unlike traditional closed NPM packages, this **Nex Recipe** injects clean TypeScript source code directly into your application's `src/` directory. You retain complete source code ownership, allowing you to modify, extend, or adapt the logic to your exact project requirements.

---

## Features

* **Direct Source Integration:** Full ownership of module, service, constants, and controller source files.
* **Dynamic Module Configuration:** Simple `RedisModule.forRoot()` setup supporting both URL connection strings and granular `ioredis` options.
* **Type-Safe JSON Support:** Native JSON serialization (`setJson`) and deserialization (`getJson<T>`) helper methods.
* **Production-Safe Pattern Deletion:** Non-blocking key deletion using Redis `SCAN` cursor iteration (`deleteByPattern`) instead of blocking `KEYS *`.
* **Native Escape Hatch:** Direct access to the underlying `ioredis` instance via `service.client` for advanced operations (Pub/Sub, Pipelines, Transactions).
* **Optional REST Controller Variant:** Pre-built higher-order controller factory (`RedisController`) for exposing RESTful cache endpoints instantly.

---

## File Architecture

When added via Nex CLI, the following file structure is generated in your workspace:

```text
recipes/
└── nestjs-basic-redis/
    └── constants/
        └── redis.constants.ts       # Injection tokens (REDIS_CLIENT)
src/
├── common/
│   ├── services/
│   │   └── redis-basic.service.ts   # Core RedisService implementation
│   └── controllers/
│       └── redis-basic.controller.ts # Generic RedisController (Variant: with-controller)
└── modules/
    └── redis/
        └── redis.module.ts          # Dynamic NestJS RedisModule definition
```

---

## Installation

Run the Nex CLI installer in your NestJS project directory:

```bash
xnex install nestjs-basic-redis
```

*The installer automatically installs the `ioredis` dependency using Bun or your preferred package manager.*

---

## Quick Start

### 1. Register Module in `AppModule`

Import `RedisModule` in your root application module and call `forRoot()`:

```typescript
import { Module } from '@nestjs/common';
import { RedisModule } from 'src/modules/redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    RedisModule.forRoot({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      // You can also pass native ioredis options:
      // host: 'localhost',
      // port: 6379,
      // password: 'secret_password',
      // db: 0,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

### 2. Inject and Use `RedisService`

Inject `RedisService` into any service, handler, or guard within your application:

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/services/redis-basic.service';

interface UserSession {
  userId: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly redisService: RedisService) {}

  // Store plain text with 1 hour TTL (3600s)
  async cacheToken(userId: string, token: string): Promise<void> {
    await this.redisService.set(`auth:token:${userId}`, token, 3600);
  }

  // Store complex objects automatically serialized as JSON
  async createUserSession(session: UserSession): Promise<void> {
    await this.redisService.setJson(`session:${session.userId}`, session, 86400);
  }

  // Retrieve deserialized JSON object with strong typing
  async getUserSession(userId: string): Promise<UserSession | null> {
    return await this.redisService.getJson<UserSession>(`session:${userId}`);
  }

  // Remove keys matching a pattern safely using SCAN
  async invalidateUserSessions(userId: string): Promise<number> {
    return await this.redisService.deleteByPattern(`session:${userId}:*`);
  }
}
```

---

## API Reference

### `RedisService`

#### Property: `client`

* **Type:** `Redis` (ioredis instance)
* **Description:** Escape hatch granting direct access to the native `ioredis` client for advanced commands, pipeline execution, or Pub/Sub handlers.

```typescript
const pipeline = redisService.client.pipeline();
pipeline.set('key1', 'val1');
pipeline.set('key2', 'val2');
await pipeline.exec();
```

---

#### Method: `set(key, value, ttlSeconds?)`

* **Parameters:**
* `key`: `string`
* `value`: `string`
* `ttlSeconds` *(optional)*: `number`


* **Returns:** `Promise<'OK' | null>`
* **Description:** Stores a string key-value pair. If `ttlSeconds` is provided, sets an expiration timer using `EX`.

---

#### Method: `get(key)`

* **Parameters:**
* `key`: `string`


* **Returns:** `Promise<string | null>`
* **Description:** Retrieves the string value associated with `key`. Returns `null` if key does not exist or connection fails.

---

#### Method: `del(key)`

* **Parameters:**
* `key`: `string`


* **Returns:** `Promise<number>`
* **Description:** Deletes a specific key. Returns the number of removed keys (0 or 1).

---

#### Method: `exists(key)`

* **Parameters:**
* `key`: `string`


* **Returns:** `Promise<boolean>`
* **Description:** Checks key existence in Redis without downloading the payload.

---

#### Method: `deleteByPattern(pattern)`

* **Parameters:**
* `pattern`: `string` (e.g., `'sessions:*'`)


* **Returns:** `Promise<number>`
* **Description:** Safe, non-blocking removal of keys matching a glob pattern using `SCAN` cursor iteration (batch count: 100).

---

#### Method: `setJson(key, value, ttlSeconds?)`

* **Parameters:**
* `key`: `string`
* `value`: `any`
* `ttlSeconds` *(optional)*: `number`


* **Returns:** `Promise<'OK' | null>`
* **Description:** Serializes `value` to a JSON string and stores it in Redis with optional TTL.

---

#### Method: `getJson<T>(key)`

* **Parameters:**
* `key`: `string`


* **Returns:** `Promise<T null |>`
* **Description:** Retrieves a JSON string and deserializes it to type `T`. Returns `null` if key does not exist or parsing fails.

---

#### Method: `flushAll()`

* **Returns:** `Promise<string>`
* **Description:** Clears all keys across all Redis databases. Intended for testing environments.

---

## Variant: `with-controller`

If installed with `--variant with-controller`, the recipe includes a Higher-Order Base Controller factory (`RedisController`) to automatically expose RESTful caching endpoints.

### Creating a Cache Controller

Create a controller file and extend the higher-order function passing `RedisService`:

```typescript
// src/controllers/cache.controller.ts
import { Controller } from '@nestjs/common';
import { RedisService } from 'src/common/services/redis-basic.service';
import { RedisController } from 'src/common/controllers/redis-basic.controller';

@Controller('cache')
export class CacheController extends RedisController(RedisService) {}
```

Register `CacheController` in your module's `controllers` array.

---

### Endpoints Exposed

| Method | Endpoint | Query / Body Params | Description |
| --- | --- | --- | --- |
| **GET** | `/:key` | - | Fetch value by key. Auto-parses JSON string if valid. |
| **GET** | `/exists/:key` | - | Returns `{ "exists": boolean }`. |
| **POST** | `/` | `{ "key": string, "value": any, "ttlSeconds"?: number }` | Set key-value. Handles primitive strings and JSON objects. |
| **DELETE** | `/:key` | - | Delete single key. Returns `{ "deleted": boolean, "count": number }`. |
| **DELETE** | `/pattern/clear` | `?match=pattern:*` | Non-blocking pattern clear via SCAN. Returns `{ "deletedCount": number }`. |

---

YOU ARE THE OWNER OF THE CODE.🌟
