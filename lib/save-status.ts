/** A Firestore write that never settles must not leave the editor on “Saving…”. */
export function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Saving timed out.'));
    }, ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function describeSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  const detail = `${code} ${message}`;
  if (/resource-exhausted|quota/i.test(detail)) {
    return 'Firestore is out of quota, so this lesson was not saved. Your changes are kept on this device.';
  }
  if (/timed out/i.test(message)) {
    return 'Saving timed out. Your changes are kept on this device.';
  }
  return message || 'Saving failed. Your changes are kept on this device.';
}
