import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditAction, AuditLog, AuditLogDocument } from './audit-log.schema';

@Injectable()
export class AuditLogService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>) {}
  async record(action: AuditAction, userId: string | null, success: boolean, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.model.create({ userId: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null, action, success, metadata });
  }
}
