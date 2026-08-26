export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'API_ERROR'
  ) {
    super(message);
  }
}

export const invalidCredentialsError = () =>
  new ApiError(401, 'E-mail ou senha invalidos.', 'INVALID_CREDENTIALS');

export const unauthorizedError = () =>
  new ApiError(401, 'Autenticacao necessaria.', 'UNAUTHORIZED');

export const forbiddenError = () => new ApiError(403, 'Acesso nao autorizado.', 'FORBIDDEN');
