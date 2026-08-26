import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(request: Request, response: Response, next: NextFunction) {
  const id = request.header('x-request-id') ?? randomUUID();
  response.setHeader('x-request-id', id);
  request.id = id;
  next();
}
