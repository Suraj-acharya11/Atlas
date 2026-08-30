import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import Account from '../app/account';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { queryClient } from '../lib/query-client';

jest.mock('expo-router', () => ({ Redirect: () => null, router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../lib/api-client', () => ({ apiRequest: jest.fn() }));

const SecureStore = jest.requireMock('expo-secure-store') as { getItemAsync: jest.Mock; deleteItemAsync: jest.Mock };
const router = jest.requireMock('expo-router').router as { replace: jest.Mock };

function AuthProbe() {
  const { token, user, signOut } = useAuth();
  return <><Text testID="session">{token ?? 'logged-out'}</Text><Text testID="user">{user?.email ?? 'no-user'}</Text><Button title="Sign out" onPress={() => { void signOut(); }} /></>;
}

function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return <Text onPress={onPress}>{title}</Text>;
}

describe('account session completion', () => {
  beforeEach(() => {
    SecureStore.deleteItemAsync.mockClear();
    router.replace.mockClear();
    jest.spyOn(queryClient, 'clear').mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('removes the JWT, clears the query cache, and clears auth state on sign out', async () => {
    const screen = render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('session').props.children).toBe('logged-out'));
    fireEvent.press(screen.getByText('Sign out'));

    await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('jwt'));
    expect(queryClient.clear).toHaveBeenCalled();
    expect(screen.getByTestId('session').props.children).toBe('logged-out');
    expect(screen.getByTestId('user').props.children).toBe('no-user');
  });

  it('redirects the account screen to login after successful sign out', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDAwMDB9.signature');
    const screen = render(<AuthProvider><Account /></AuthProvider>);
    await screen.findByText('Sign out');
    fireEvent.press(screen.getByText('Sign out'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(auth)/login'));
  });
});
