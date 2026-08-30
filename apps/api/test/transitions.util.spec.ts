import { BadRequestException } from '@nestjs/common';
import { assertTransition } from '../src/execution/transitions.util';

describe('Execution transitions', () => {
  it('allows every legal transition', () => {
    expect(() => assertTransition('started', 'paused')).not.toThrow();
    expect(() => assertTransition('started', 'completed')).not.toThrow();
    expect(() => assertTransition('started', 'partial')).not.toThrow();
    expect(() => assertTransition('started', 'abandoned')).not.toThrow();
    expect(() => assertTransition('paused', 'resumed')).not.toThrow();
    expect(() => assertTransition('paused', 'abandoned')).not.toThrow();
    expect(() => assertTransition('resumed', 'paused')).not.toThrow();
    expect(() => assertTransition('resumed', 'completed')).not.toThrow();
    expect(() => assertTransition('resumed', 'partial')).not.toThrow();
    expect(() => assertTransition('resumed', 'abandoned')).not.toThrow();
  });
  it('rejects illegal and terminal transitions', () => {
    expect(() => assertTransition('started', 'resumed')).toThrow(BadRequestException);
    expect(() => assertTransition('completed', 'paused')).toThrow(BadRequestException);
    expect(() => assertTransition('abandoned', 'completed')).toThrow(BadRequestException);
  });
});
