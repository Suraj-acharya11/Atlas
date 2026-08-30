import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { GoalService } from '../src/goal/goal.service';

const chain = (value: any) => ({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) });

describe('GoalService Phase 1 ownership', () => {
  const userId = new Types.ObjectId().toHexString();
  const model: any = { create: jest.fn(), findOne: jest.fn(), find: jest.fn(), findOneAndUpdate: jest.fn(), countDocuments: jest.fn() };
  const events: any = { record: jest.fn() };
  let service: GoalService;
  beforeEach(() => { jest.clearAllMocks(); service = new GoalService(model, events); });
  it('filters reads by the acting user', async () => { model.findOne.mockReturnValue(chain(null)); await expect(service.findOwnedOrThrow(userId, new Types.ObjectId().toHexString())).rejects.toBeInstanceOf(NotFoundException); expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({ userId: new Types.ObjectId(userId) })); });
  it('records creation after the goal write', async () => { const goal = { id: new Types.ObjectId().toHexString(), toObject: () => ({}) }; model.create.mockResolvedValue(goal); await service.create(userId, { title: 'Study', description: 'Exam' }); expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'GOAL_CREATED', userId })); });
});
