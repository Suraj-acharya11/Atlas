import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}
