export class AppError extends Error {
  constructor(public code: string, public status = 400, message?: string) {
    super(message ?? code);
  }
}

export function errCode(e: unknown): string {
  return e instanceof AppError ? e.code : 'INTERNAL';
}
