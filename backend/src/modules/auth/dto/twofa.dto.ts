import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFaDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class VerifyTwoFaDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class DisableTwoFaDto {
  @ApiProperty({ description: '6-digit TOTP code to confirm disable' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}

export class RecoveryCodeDto {
  @ApiProperty({ description: '8-character recovery code' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 10)
  recoveryCode: string;
}

/** Second login step: challenge from /auth/login + a TOTP code or recovery code. */
export class TwoFaLoginDto {
  @ApiProperty({ description: 'challengeToken returned by /auth/login when requires2FA is true' })
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @ApiProperty({ required: false, description: '6-digit TOTP code' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  code?: string;

  @ApiProperty({ required: false, description: 'One-time recovery code' })
  @IsOptional()
  @IsString()
  @Length(8, 12)
  recoveryCode?: string;
}
