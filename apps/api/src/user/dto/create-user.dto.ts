import { IsEmail, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) passwordHash!: string;
  @IsString() timezone!: string;
  @IsOptional() @IsObject() preferences?: Record<string, unknown>;
}
