import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FocusAction } from '../app/(tabs)/dashboard';
import { apiRequest } from '../lib/api-client';
import { formatElapsedDuration } from '../lib/execution';
import type { Decision, ExecutionRecord, Mission, Task } from '../lib/types';

jest.mock('../lib/api-client', () => ({ apiRequest: jest.fn() }));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;
const task: Task = { _id: 'task-1', title: 'Ship the next step', status: 'todo' };
const decision: Decision = { _id: 'decision-1', topCandidateId: task._id, topExplanation: 'It is the highest-value next action.' };
const mission: Mission = { _id: 'mission-1', date: '2026-08-25' };
const startedAt = '2026-08-25T10:00:00.000Z';

function record(status: ExecutionRecord['status'] = 'started'): ExecutionRecord {
  return { _id: 'execution-1', taskId: task._id, missionId: mission._id, status, startedAt, endedAt: null, actualDurationMinutes: 0, progressPercent: 0 };
}

function renderFocus() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><FocusAction decision={decision} mission={mission} tasks={[task]} /></QueryClientProvider>);
}

describe('focus execution flow', () => {
  beforeEach(() => request.mockReset());

  it('starts an execution and displays the server-backed active session', async () => {
    request.mockResolvedValueOnce(record());
    const screen = renderFocus();

    fireEvent.press(screen.getByText('▶  Start now'));

    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/v1/execution', { method: 'POST', body: { taskId: 'task-1', missionId: 'mission-1' } }));
    expect(await screen.findByText('Active focus session')).toBeTruthy();
    expect(screen.getByText('Elapsed from the server start time')).toBeTruthy();
  });

  it('sends a supported transition and keeps the returned execution state', async () => {
    request.mockResolvedValueOnce(record());
    const screen = renderFocus();
    fireEvent.press(screen.getByText('▶  Start now'));
    await screen.findByText('Complete focus session');

    request.mockResolvedValueOnce({ ...record('completed'), endedAt: '2026-08-25T10:25:00.000Z', actualDurationMinutes: 25, progressPercent: 100 });
    fireEvent.press(screen.getByText('Complete focus session'));

    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/api/v1/execution/execution-1/transition', { method: 'POST', body: { status: 'completed' } }));
    expect(await screen.findByText('Session completed')).toBeTruthy();
    expect(screen.getByText('25 minutes recorded by ATLAS')).toBeTruthy();
  });

  it('shows a useful error and does not change the session when a mutation fails', async () => {
    request.mockRejectedValueOnce(new Error('Execution service unavailable'));
    const screen = renderFocus();
    fireEvent.press(screen.getByText('▶  Start now'));

    expect(await screen.findByText('Execution service unavailable')).toBeTruthy();
    expect(screen.getByText('▶  Start now')).toBeTruthy();
  });

  it('prevents duplicate start submissions while the request is pending', async () => {
    let resolve: (value: ExecutionRecord) => void = () => undefined;
    request.mockReturnValueOnce(new Promise<ExecutionRecord>((complete) => { resolve = complete; }));
    const screen = renderFocus();
    const button = screen.getByText('▶  Start now');

    fireEvent.press(button);
    fireEvent.press(button);
    expect(request).toHaveBeenCalledTimes(1);
    resolve(record());
    await screen.findByText('Active focus session');
  });

  it('calculates elapsed time from the persisted start timestamp', () => {
    expect(formatElapsedDuration(startedAt, Date.parse('2026-08-25T11:01:05.000Z'))).toBe('01:01:05');
  });
});
