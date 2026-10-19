import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateListingDetailsDto {
  // Shape is validated field-by-field in listing-details.ts (normalizeListingDetails)
  @ApiProperty({ description: 'Listing detail sections, each with an `approved` flag' })
  @IsObject()
  listingDetails: Record<string, any>;
}
