import { KnowledgeReflectionSignalProcessor } from '../src/knowledge/reflection-signal.processor';
import { MlReflectionSignalProcessor } from '../src/ml/reflection-signal.processor';

describe('Reflection signal consumers', () => {
  const signal = { userId: 'u1', taskId: 't1', missionId: 'm1', timeEstimate: 'accurate', difficulty: 'accurate', progress: 'overestimated', planAdherence: 'partial', cause: 'unknown' };
  it('passes the signal through KnowledgeService.evaluate()', async () => {
    const knowledge: any = { evaluate: jest.fn().mockResolvedValue(null) };
    await new KnowledgeReflectionSignalProcessor(knowledge).process({ data: { signalId: 's1', signal } } as any);
    expect(knowledge.evaluate).toHaveBeenCalledWith({
      userId: 'u1',
      payload: {
        knowledge: {
          subject: 'user',
          predicate: 'underestimates_duration',
          object: 'task',
          category: 'behavioral_pattern',
          supports: false,
        },
      },
    });
    expect(knowledge.evaluate).toHaveBeenCalledWith({
      userId: 'u1',
      payload: {
        knowledge: {
          subject: 'user',
          predicate: 'overestimates_duration',
          object: 'task',
          category: 'behavioral_pattern',
          supports: false,
        },
      },
    });
  });

  it('passes the signal to the ML training-data seam', async () => {
    const ml: any = { recordLearningSignal: jest.fn().mockResolvedValue(undefined) };
    await new MlReflectionSignalProcessor(ml).process({ data: { signalId: 's1', signal } } as any);
    expect(ml.recordLearningSignal).toHaveBeenCalledWith(signal);
  });
});
