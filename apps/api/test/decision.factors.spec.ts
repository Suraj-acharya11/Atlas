import { ContextFitFactor } from '../src/decision/factors/context-fit.factor';
import { DeadlineUrgencyFactor } from '../src/decision/factors/deadline-urgency.factor';
import { DifficultyPenaltyFactor } from '../src/decision/factors/difficulty-penalty.factor';
import { EnergyFitFactor } from '../src/decision/factors/energy-fit.factor';
import { GoalImportanceFactor } from '../src/decision/factors/goal-importance.factor';
import { KnowledgeSupportFactor } from '../src/decision/factors/knowledge-support.factor';

describe('Decision factors', () => {
  it('scores primary and secondary goal importance', () => {
    const factor = new GoalImportanceFactor();
    expect(factor.evaluate({ id: '1', title: 'x', activeGoalIds: ['g1'] }, { primaryGoalId: 'g1' })).toBe(100);
    expect(factor.evaluate({ id: '1', title: 'x', activeGoalIds: ['g2'] }, { primaryGoalId: 'g1' })).toBe(50);
    expect(factor.evaluate({ id: '1', title: 'x' }, {})).toBe(0);
  });
  it('increases deadline urgency as the deadline approaches', () => {
    const factor = new DeadlineUrgencyFactor();
    const now = new Date('2026-01-01T00:00:00Z');
    expect(factor.evaluate({ id: '1', title: 'x', deadline: new Date('2026-01-01T00:00:00Z') }, { now })).toBe(100);
    expect(factor.evaluate({ id: '1', title: 'x', deadline: new Date('2026-01-15T00:00:00Z') }, { now })).toBe(0);
  });
  it('scores context fit by available time', () => {
    const factor = new ContextFitFactor();
    expect(factor.evaluate({ id: '1', title: 'x', estimatedDurationMinutes: 20 }, { availableMinutes: 20 })).toBe(100);
    expect(factor.evaluate({ id: '1', title: 'x', estimatedDurationMinutes: 40 }, { availableMinutes: 20 })).toBe(50);
  });
  it('scores energy fit by difficulty match', () => {
    const factor = new EnergyFitFactor();
    expect(factor.evaluate({ id: '1', title: 'x', difficulty: 3 }, { energy: 3 })).toBe(100);
    expect(factor.evaluate({ id: '1', title: 'x', difficulty: 3 }, { energy: 1 })).toBe(50);
  });
  it('uses stored Knowledge confidence and difficulty penalty', () => {
    expect(new KnowledgeSupportFactor().evaluate({ id: '1', title: 'x', knowledgeConfidence: 72 }, {})).toBe(72);
    expect(new DifficultyPenaltyFactor().evaluate({ id: '1', title: 'x', difficulty: 4 }, {})).toBe(80);
  });
});
