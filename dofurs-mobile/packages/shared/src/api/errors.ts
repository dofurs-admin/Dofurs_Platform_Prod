export class ApiError extends Error {
  status: number;
  details: unknown;
  endpoint: string;

  constructor(message: string, status: number, endpoint: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
  }
}
