import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TwoFaService } from './twofa.service';
import { PrismaService } from '../../database/prisma.service';

/** Independent RFC 6238 implementation, so the test checks the service against the spec. */
function totp(base32Secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of base32Secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const n = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(n).padStart(6, '0');
}

describe('TwoFaService', () => {
  let service: TwoFaService;
  // In-memory stand-in for the users row the service reads/writes with raw SQL
  let row: { email: string; twoFactorEnabled: boolean; twoFactorSecret: string | null; twoFactorRecoveryCodes: string[] };

  const prisma = {
    $queryRaw: jest.fn(async () => [row]),
    $executeRawUnsafe: jest.fn(async (sql: string, ...values: any[]) => {
      // values follow the SET order: enabled, secret, codes (only those present), then id
      const sets = sql.match(/"(\w+)" = \$\d+/g)!.map((s) => s.match(/"(\w+)"/)![1]);
      sets.forEach((col, i) => {
        (row as any)[col] = col === 'twoFactorRecoveryCodes' ? JSON.parse(values[i]) : values[i];
      });
      return 1;
    }),
  };

  beforeEach(async () => {
    row = { email: 'user@test.com', twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] };
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TwoFaService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TwoFaService);
  });

  it('queries the real "users" table', async () => {
    await service.getStatus('user-1');
    const sqlParts = (prisma.$queryRaw.mock.calls[0] as any[])[0] as string[];
    expect(sqlParts.join('')).toMatch(/FROM users/);
  });

  describe('setup and enable', () => {
    it('generates a secret, otpauth URL and 8 backup codes', async () => {
      const result = await service.generateSetupData('user-1');
      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
      expect(result.qrCodeUrl).toContain('otpauth://totp/');
      expect(result.backupCodes).toHaveLength(8);
      expect(row.twoFactorEnabled).toBe(false);
    });

    it('refuses setup when 2FA is already on', async () => {
      row.twoFactorEnabled = true;
      await expect(service.generateSetupData('user-1')).rejects.toThrow(BadRequestException);
    });

    it('enables 2FA with a valid authenticator code and rejects a wrong one', async () => {
      const { secret } = await service.generateSetupData('user-1');
      await expect(service.enable('user-1', '000000' === totp(secret) ? '111111' : '000000')).rejects.toThrow('Invalid authentication code');
      await service.enable('user-1', totp(secret));
      expect(row.twoFactorEnabled).toBe(true);
      expect(await service.isEnabled('user-1')).toBe(true);
    });
  });

  describe('login verification', () => {
    it('accepts the current code and a code from the previous 30s window', async () => {
      const { secret } = await service.generateSetupData('user-1');
      await service.enable('user-1', totp(secret));
      expect(await service.verifyForLogin('user-1', totp(secret))).toBe(true);
      expect(await service.verifyForLogin('user-1', totp(secret, Date.now() - 30_000))).toBe(true);
    });

    it('rejects malformed codes', () => {
      expect(service.verifyCode('JBSWY3DPEHPK3PXP', 'abcdef')).toBe(false);
      expect(service.verifyCode('JBSWY3DPEHPK3PXP', '12345')).toBe(false);
    });
  });

  describe('recovery codes', () => {
    it('accepts a backup code once, then rejects it', async () => {
      const { secret, backupCodes } = await service.generateSetupData('user-1');
      await service.enable('user-1', totp(secret));
      const code = backupCodes[0];
      expect(await service.verifyRecoveryCode('user-1', code)).toBe(true);
      expect(await service.verifyRecoveryCode('user-1', code)).toBe(false);
      expect(row.twoFactorRecoveryCodes).toHaveLength(7);
    });

    it('rejects an unknown code', async () => {
      row.twoFactorRecoveryCodes = ['AAAA1111'];
      expect(await service.verifyRecoveryCode('user-1', 'BBBB2222')).toBe(false);
    });
  });

  it('disable needs a valid code and clears the secret', async () => {
    const { secret } = await service.generateSetupData('user-1');
    await service.enable('user-1', totp(secret));
    await service.disable('user-1', totp(secret));
    expect(row.twoFactorEnabled).toBe(false);
    expect(row.twoFactorSecret).toBeNull();
  });
});
