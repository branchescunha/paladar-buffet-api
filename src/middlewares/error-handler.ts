import { ZodError } from 'zod';
import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../shared/errors.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } });
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }

  const message = process.env.NODE_ENV === 'production' ? 'Erro interno.' : error.message;
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message } });
};
