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
  new ApiError(401, 'E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');

export const unauthorizedError = () =>
  new ApiError(401, 'Autenticação necessária.', 'UNAUTHORIZED');

export const forbiddenError = () => new ApiError(403, 'Acesso não autorizado.', 'FORBIDDEN');

export const notFoundError = () => new ApiError(404, 'Recurso não encontrado.', 'NOT_FOUND');

export const passwordChangeRequiredError = () =>
  new ApiError(403, 'Troca de senha obrigatória.', 'PASSWORD_CHANGE_REQUIRED');
