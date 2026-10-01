import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

// Mock ioredis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  scan: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: any) => {
              const config: Record<string, any> = {
                'redis.url': 'redis://localhost:6379',
                'redis.host': 'localhost',
                'redis.port': 6379,
                'redis.password': '',
              };
              return config[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    service.onModuleInit();

    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const testData = { name: 'test', value: 42 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.get('error-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store serialized value with TTL', async () => {
      await service.set('test-key', { data: 'value' }, 300);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        JSON.stringify({ data: 'value' }),
      );
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await service.del('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('invalidate', () => {
    it('should delete all keys matching namespace pattern', async () => {
      // invalidate() uses SCAN (non-blocking) rather than KEYS
      mockRedis.scan.mockResolvedValueOnce(['0', ['ns:key1', 'ns:key2', 'ns:key3']]);

      await service.invalidate('ns');

      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'ns:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('ns:key1', 'ns:key2', 'ns:key3');
    });

    it('should not call del when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidate('empty');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
