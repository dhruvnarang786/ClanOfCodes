// ─── Custom API Error Class ──────────────────────────────────────────
//
// Why: Express needs a way to know WHICH HTTP status code to return
// when something goes wrong. A plain `new Error("not found")` doesn't
// carry a status code, so we extend Error to include one.
//
// Usage: throw new ApiError(404, "Problem not found");
//
// Express 5 automatically catches thrown errors (including from async
// handlers) and forwards them to the error-handling middleware.

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace in V8 engines (Node.js)
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
