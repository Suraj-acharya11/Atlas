import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { applyDecay, applyEvidence, isActive, NEW_CANDIDATE_CONFIDENCE } from './confidence.util';
import { dimensionForPredicate } from './predicate-dimensions';
import { KnowledgeDocument, KnowledgeRelationship, KNOWLEDGE_CATEGORIES } from './schemas/knowledge.schema';

type KnowledgeEvidence = { subject: string; predicate: string; object: string; category: (typeof KNOWLEDGE_CATEGORIES)[number]; supports?: boolean };
type KnowledgeEvent = { _id?: Types.ObjectId | string; userId: Types.ObjectId | string; payload: Record<string, unknown> };
export type KnowledgeQuery = { subject?: string; predicate?: string; category?: string; status?: 'pending' | 'active' };

@Injectable()
export class KnowledgeService {
  constructor(@InjectModel(KnowledgeRelationship.name) private readonly model: Model<KnowledgeDocument>) {}

  async query(userId: string, filters: KnowledgeQuery = {}): Promise<KnowledgeDocument[]> {
    return this.model.find({ userId: new Types.ObjectId(userId), ...filters }).sort({ lastUpdatedAt: -1 }).lean().exec() as Promise<KnowledgeDocument[]>;
  }

  async findById(userId: string, relationshipId: string): Promise<KnowledgeDocument | null> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(relationshipId)) return null;
    return this.model.findOne({ _id: new Types.ObjectId(relationshipId), userId: new Types.ObjectId(userId), supersededBy: null }).lean().exec() as Promise<KnowledgeDocument | null>;
  }

  async delete(userId: string, relationshipId: string): Promise<void> {
    const result = await this.model.deleteOne({ _id: new Types.ObjectId(relationshipId), userId: new Types.ObjectId(userId) }).exec();
    if (!result.deletedCount) throw new NotFoundException('Knowledge relationship not found');
  }

  async evaluate(event: KnowledgeEvent): Promise<KnowledgeDocument | null> {
    const candidate = this.extractEvidence(event.payload);
    if (!candidate) return null;
    const userId = new Types.ObjectId(event.userId);
    const eventId = event._id ? new Types.ObjectId(event._id) : undefined;
    let relationship = await this.model.findOne({ userId, subject: candidate.subject, predicate: candidate.predicate, object: candidate.object, supersededBy: null }).exec();
    const isSupporting = candidate.supports !== false;
    const now = new Date();
    if (!relationship) relationship = await this.model.create({ userId, subject: candidate.subject, predicate: candidate.predicate, object: candidate.object, category: candidate.category, confidence: NEW_CANDIDATE_CONFIDENCE, status: 'pending', supportingEventIds: [], evidenceCount: 0, createdAt: now, lastUpdatedAt: now, supersededBy: null });
    if (eventId && relationship.supportingEventIds.some((id) => id.equals(eventId))) return relationship;
    relationship.confidence = applyEvidence(relationship.confidence, isSupporting);
    relationship.evidenceCount += 1;
    if (isSupporting && eventId) relationship.supportingEventIds.push(eventId);
    relationship.status = isActive(relationship.confidence, relationship.evidenceCount) ? 'active' : 'pending';
    relationship.lastUpdatedAt = now;
    relationship = await relationship.save();
    await this.resolveConflict(relationship);
    return relationship;
  }

  async decayStale(now = new Date()): Promise<number> {
    let changed = 0;
    const cutoff = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const cursor = this.model.find({ lastUpdatedAt: { $lt: cutoff }, supersededBy: null }).cursor();
    for await (const relationship of cursor) {
      const confidence = applyDecay(relationship.confidence, 3);
      if (confidence !== relationship.confidence) { relationship.confidence = confidence; relationship.status = isActive(confidence, relationship.evidenceCount) ? 'active' : 'pending'; relationship.lastUpdatedAt = now; await relationship.save(); changed += 1; }
    }
    return changed;
  }

  private async resolveConflict(current: KnowledgeDocument): Promise<void> {
    if (current.status !== 'active') return;
    const dimension = dimensionForPredicate(current.predicate);
    const candidates = await this.model.find({ userId: current.userId, subject: current.subject, supersededBy: null, status: 'active', _id: { $ne: current._id } }).exec();
    for (const other of candidates) {
      if (dimensionForPredicate(other.predicate) !== dimension) continue;
      if (current.confidence >= other.confidence) { other.supersededBy = current._id; await other.save(); }
      else { current.supersededBy = other._id; await current.save(); return; }
    }
  }

  private extractEvidence(payload: Record<string, unknown>): KnowledgeEvidence | null {
    const value = (payload.knowledge ?? payload) as Partial<KnowledgeEvidence>;
    if (typeof value.subject !== 'string' || typeof value.predicate !== 'string' || typeof value.object !== 'string' || !KNOWLEDGE_CATEGORIES.includes(value.category as never)) return null;
    return { subject: value.subject, predicate: value.predicate, object: value.object, category: value.category as KnowledgeEvidence['category'], supports: value.supports };
  }
}
