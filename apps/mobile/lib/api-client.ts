import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { ApiError } from '@atlas/shared';
import { notifyUnauthorized } from './auth-events';

export class ClientError extends Error {
  constructor(public readonly response: ApiError) {
    super(response.message);
    this.name = 'ClientError';
  }
}

export class NetworkUnavailableError extends Error {
  readonly isNetworkError = true;
  constructor(message = 'Network unavailable. You are currently offline.') {
    super(message);
    this.name = 'NetworkUnavailableError';
  }
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof NetworkUnavailableError) return true;
  if (typeof error === 'object' && (error as any).isNetworkError === true) return true;
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('load failed') ||
      msg.includes('connection refused')
    );
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('network unavailable') ||
      msg.includes('failed to fetch') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    );
  }
  return false;
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const base = Constants.expoConfig?.extra?.API_BASE_URL as string | undefined;
  if (!base) throw new Error('API_BASE_URL is not configured');

  const token = await SecureStore.getItemAsync('jwt');
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const body = options.body === undefined ? undefined : isFormData ? (options.body as BodyInit) : JSON.stringify(options.body);

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...options, headers, body });
  } catch (err) {
    if (isNetworkError(err)) {
      throw new NetworkUnavailableError();
    }
    throw err;
  }

  const payload = await response.json().catch(() => undefined);
  if (response.status === 401) {
    await SecureStore.deleteItemAsync('jwt');
    notifyUnauthorized();
  }
  if (!response.ok) {
    throw new ClientError(payload ?? { statusCode: response.status, message: response.statusText });
  }
  return payload as T;
}
