import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  // Optional: browsers send it as an HttpOnly cookie instead of in the body.
  @ApiPropertyOptional({ example: 'uuid-refresh-token' })
  @IsOptional()
  @IsString()
  @IsUUID()
  refreshToken?: string;
}
