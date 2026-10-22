import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import Reflection from '../app/(tabs)/reflection';
import { useReflections } from '../lib/queries';
import type { Reflection as ReflectionSignal } from '../lib/types';

jest.mock('../lib/queries', () => ({ useReflections: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

const useReflectionsMock = useReflections as jest.Mock;
const router = jest.requireMock('expo-router').router as { push: jest.Mock; replace: jest.Mock };
const signal: ReflectionSignal = {
  _id: 'signal-1',
  taskId: 'task-1',
  missionId: 'mission-1',
  executionRecordId: 'execution-1',
  timeEstimate: 'accurate',
  difficulty: 'overestimated',
  progress: 'accurate',
  planAdherence: 'partial',
  cause: 'unknown',
  createdAt: '2026-08-25T10:00:00.000Z',
};

function query(data: ReflectionSignal[] | undefined, overrides: Record<string, unknown> = {}) {
  return { isLoading: false, isError: false, error: null, data, dataUpdatedAt: Date.now(), refetch: jest.fn(), ...overrides };
}

describe('reflection screen', () => {
  beforeEach(() => {
    useReflectionsMock.mockReset();
    router.push.mockReset();
  });

  it('renders actual LearningSignal fields', () => {
    useReflectionsMock.mockReturnValue(query([signal]));
    const screen = render(<Reflection />);

    expect(screen.getByText('Time estimate: accurate')).toBeTruthy();
    expect(screen.getAllByText('accurate')).toHaveLength(2);
    expect(screen.getByText('overestimated')).toBeTruthy();
    expect(screen.getByText('Plan adherence: partial')).toBeTruthy();
    expect(screen.getByText('unknown')).toBeTruthy();
  });

  it('shows the empty state and explains that signals follow execution', () => {
    useReflectionsMock.mockReturnValue(query([]));
    const screen = render(<Reflection />);

    expect(screen.getByText('No learning signals recorded yet. Complete or finish a focus execution to generate one.')).toBeTruthy();
    expect(screen.getByText(/User-entered reflection text is not supported yet/)).toBeTruthy();
  });

  it('does not pretend to submit a reflection and links to Focus instead', () => {
    useReflectionsMock.mockReturnValue(query([]));
    const screen = render(<Reflection />);
    fireEvent.press(screen.getByText('Go to Today’s Mission & Focus'));

    expect(router.push).toHaveBeenCalledWith('/timetable');
  });

  it('uses the shared loading and error states', () => {
    useReflectionsMock.mockReturnValue(query(undefined, { isLoading: true }));
    expect(render(<Reflection />).getByText('Loading ATLAS…')).toBeTruthy();

    useReflectionsMock.mockReturnValue(query(undefined, { isLoading: false, isError: true, error: new Error('Signals unavailable') }));
    const screen = render(<Reflection />);
    expect(screen.getByText('Couldn’t load this section.')).toBeTruthy();
    expect(screen.getByText('Signals unavailable')).toBeTruthy();
  });
});
