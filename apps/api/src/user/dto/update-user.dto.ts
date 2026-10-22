import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}
