type UnauthorizedListener = () => void;

const listeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyUnauthorized() {
  listeners.forEach((listener) => listener());
}
