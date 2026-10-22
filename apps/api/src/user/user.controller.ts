import { BadRequestException, Body, Controller, Delete, Get, Patch, Post, Req, UsePipes, ValidationError, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { actingUserId } from '../common/authenticated-request';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImportUserDataDto } from './dto/import-user-data.dto';
import { PrivacyService } from './privacy.service';
import { UserService } from './user.service';

@Controller('api/v1/users')
export class UserController {
  constructor(
    private readonly service: UserService,
    private readonly privacy: PrivacyService,
  ) {}

  @Get('me')
  getMe(@Req() req: Request) {
    return this.service.findById(actingUserId(req));
  }

  @Get('me/export')
  export(@Req() req: Request) {
    return this.privacy.exportUserData(actingUserId(req));
  }

  @Post('me/import')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages: string[] = [];
        function collect(errs: ValidationError[]) {
          for (const err of errs) {
            if (err.constraints) {
              messages.push(...Object.values(err.constraints));
            }
            if (err.children?.length) {
              collect(err.children);
            }
          }
        }
        collect(errors);
        const preview = messages.slice(0, 2).join('; ');
        const remaining = messages.length > 2 ? ` (+${messages.length - 2} more)` : '';
        return new BadRequestException(`Import validation failed: ${preview}${remaining}`);
      },
    }),
  )
  importData(@Req() req: Request, @Body() body: ImportUserDataDto) {
    return this.privacy.importUserData(actingUserId(req), body);
  }

  @Patch('me')
  updateMe(@Req() req: Request, @Body() body: UpdateUserDto) {
    return this.service.update(actingUserId(req), body);
  }

  @Delete('me')
  deleteMe(@Req() req: Request) {
    return this.service.deleteAccount(actingUserId(req));
  }
}
