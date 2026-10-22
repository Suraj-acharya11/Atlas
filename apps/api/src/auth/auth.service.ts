import { ConflictException, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { EventService } from '../event/event.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { seedInitialPersonalization } from '../knowledge/initial-personalization.seed';
import { User, UserDocument } from '../user/schemas/user.schema';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwt: JwtService,
    private readonly events: EventService,
    private readonly audit: AuditLogService,
    @Optional() private readonly knowledge?: KnowledgeService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.toLowerCase();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      const user = await this.users.create({ email, passwordHash, timezone: input.timezone, preferences: input.preferences ?? {} });
      await this.events.record({ type: 'USER_CREATED', userId: user.id, payload: { userId: user.id } });
      if (this.knowledge) {
        await seedInitialPersonalization(this.knowledge, user.id);
      }
      return this.issueToken(user);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  async login(input: LoginDto) {
    const email = input.email.toLowerCase();
    const user = await this.users.findOne({ email }).select('+passwordHash').exec();
    if (!user || !(await argon2.verify(user.passwordHash, input.password).catch(() => false))) {
      await this.audit.record('FAILED_LOGIN', user?.id ?? null, false, { email });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.audit.record('LOGIN', user.id, true);
    return this.issueToken(user);
  }

  async changePassword(userId: string, input: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId).select('+passwordHash').exec();
    if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false))) throw new UnauthorizedException('Invalid credentials');
    user.passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await user.save();
    await this.audit.record('PASSWORD_CHANGED', userId, true);
  }

  private issueToken(user: UserDocument) {
    const publicUser = { _id: user.id, email: user.email, createdAt: user.createdAt, timezone: user.timezone, preferences: user.preferences };
    return { accessToken: this.jwt.sign({ sub: user.id }), user: publicUser };
  }
}
