import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { actingUserId } from '../common/authenticated-request';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('register')
  register(@Body() input: RegisterDto) { return this.auth.register(input); }
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() input: LoginDto) { return this.auth.login(input); }
  @Post('password')
  changePassword(@Req() request: Request, @Body() input: ChangePasswordDto) { return this.auth.changePassword(actingUserId(request), input); }
}
