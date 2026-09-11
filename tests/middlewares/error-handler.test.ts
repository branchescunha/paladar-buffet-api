import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { errorHandler } from '../../src/middlewares/error-handler.js';
import { ApiError } from '../../src/shared/errors.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

function makeResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

function makeRequest() {
  const error = vi.fn();
  return {
    id: 'request-123',
    log: { error }
  } as unknown as Request;
}

describe('errorHandler', () => {
  it('logs unexpected errors server-side while keeping the production response generic', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Database connection failed');
    const request = makeRequest();
    const response = makeResponse();

    errorHandler(error, request, response, vi.fn());

    expect(request.log.error).toHaveBeenCalledWith({ err: error, requestId: 'request-123' }, 'Unhandled request error');
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno.' } });
  });

  it('keeps ZodError and ApiError responses without logging them as unexpected errors', () => {
    const request = makeRequest();
    const response = makeResponse();
    const zodError = new ZodError([{ code: z.ZodIssueCode.custom, path: [], message: 'Invalid input' }]);

    errorHandler(zodError, request, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(400);
    expect(request.log.error).not.toHaveBeenCalled();

    const apiResponse = makeResponse();
    errorHandler(new ApiError(401, 'Credenciais inválidas.', 'INVALID_CREDENTIALS'), request, apiResponse, vi.fn());
    expect(apiResponse.status).toHaveBeenCalledWith(401);
    expect(request.log.error).not.toHaveBeenCalled();
  });
});
