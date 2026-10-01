import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { MasterPrismaService } from '../../database/master-prisma.service';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { CompanyService } from '../company/company.service';
import { MailService } from '../../common/services/mail.service';
import { TwoFaService } from './twofa.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let usersService: any;
  let jwtService: any;
  let mailService: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockTwoFaService = {
    isEnabled: jest.fn().mockResolvedValue(false),
    verifyForLogin: jest.fn(),
    verifyRecoveryCode: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      const config: Record<string, any> = {
        'jwt.secret': 'test-secret',
        'jwt.expiresIn': '7d',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '30d',
        appUrl: 'http://localhost:3000',
        appName: 'RMS Test',
      };
      return config[key] ?? defaultVal;
    }),
  };

  const mockMasterPrisma = {
    getClient: jest.fn().mockReturnValue(mockPrisma),
  };

  const mockTenantPrisma = {
    getClient: jest.fn().mockReturnValue(mockPrisma),
  };

  const mockCompanyService = {
    findByInviteCode: jest.fn(),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MasterPrismaService, useValue: mockMasterPrisma },
        { provide: TenantPrismaService, useValue: mockTenantPrisma },
        { provide: CompanyService, useValue: mockCompanyService },
        { provide: MailService, useValue: mockMailService },
        { provide: TwoFaService, useValue: mockTwoFaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = mockPrisma;
    usersService = mockUsersService;
    jwtService = mockJwtService;
    mailService = mockMailService;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'CLIENT',
        status: 'ACTIVE',
      };

      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result!.email).toBe('test@example.com');
    });

    it('should return null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: hashedPassword,
        status: 'ACTIVE',
      };

      usersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('completeTwoFactorLogin', () => {
    it('rejects an expired or forged challenge', async () => {
      mockJwtService.verify.mockImplementationOnce(() => { throw new Error('jwt expired'); });
      await expect(service.completeTwoFactorLogin('bad', '123456')).rejects.toThrow('expired');
    });

    it('rejects a token that is not a 2FA challenge (e.g. an access token)', async () => {
      mockJwtService.verify.mockReturnValueOnce({ sub: 'u1' });
      await expect(service.completeTwoFactorLogin('access-token', '123456')).rejects.toThrow('Invalid sign-in session');
    });

    it('rejects a wrong authenticator code', async () => {
      mockJwtService.verify.mockReturnValueOnce({ sub: 'u1', purpose: '2fa-login' });
      mockTwoFaService.isEnabled.mockResolvedValueOnce(true);
      mockTwoFaService.verifyForLogin.mockResolvedValueOnce(false);
      await expect(service.completeTwoFactorLogin('challenge', '000000')).rejects.toThrow('Invalid authentication code');
    });

    it('issues a session for a valid code', async () => {
      mockJwtService.verify.mockReturnValueOnce({ sub: 'u1', purpose: '2fa-login' });
      mockTwoFaService.isEnabled.mockResolvedValueOnce(true);
      mockTwoFaService.verifyForLogin.mockResolvedValueOnce(true);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@b.c', role: 'ADMIN', status: 'ACTIVE', password: 'hash' });
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      const res: any = await service.completeTwoFactorLogin('challenge', '123456');
      expect(res.accessToken).toBe('mock-token');
      expect(res.user.password).toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    it('should return success even when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result).toHaveProperty('message');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user exists', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.passwordResetToken.deleteMany.mockResolvedValue({});
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');

      expect(result).toHaveProperty('message');
    });
  });
});
