import { Types } from 'mongoose';
import { ProjectService } from '../src/project/project.service';

const chain = (value: any) => ({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value) });

describe('ProjectService Phase 1 lifecycle', () => {
  it('archives without deleting project data', async () => { const model: any = { findOneAndUpdate: jest.fn() }; const events: any = { record: jest.fn() }; const goals: any = { assertAllOwned: jest.fn() }; const service = new ProjectService(model, events, goals); const userId = new Types.ObjectId().toHexString(); const existing = { _id: new Types.ObjectId(), title: 'History' }; model.findOneAndUpdate.mockReturnValue(chain(existing)); const result = await service.archive(userId, existing._id.toHexString()); expect(result).toBe(existing); expect(model.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ $set: expect.objectContaining({ status: 'archived', archivedAt: expect.any(Date) }) }), expect.objectContaining({ new: true })); expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ type: 'PROJECT_ARCHIVED' })); });
});
