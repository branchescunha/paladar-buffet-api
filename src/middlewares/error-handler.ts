import { ZodError } from 'zod';
import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../shared/errors.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }

  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const stack = normalizedError.stack ? `\n${normalizedError.stack}` : '';
  request.log.error(
    { err: normalizedError, requestId: request.id },
    `Unhandled request error | requestId=${request.id} | ${normalizedError.name}: ${normalizedError.message}${stack}`
  );
  const message = process.env.NODE_ENV === 'production' ? 'Erro interno.' : normalizedError.message;
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
};
