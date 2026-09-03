// ─── Consistent API Response Envelope ────────────────────────────────
//
// Why: A consistent response shape makes it easy for frontend clients
// to parse responses. Every response looks like:
//   { success: true,  message: "...", data: {...} }
//   { success: false, message: "Something went wrong" }
//
// Usage:
//   res.status(200).json(new ApiResponse(200, data, "Success"));

export class ApiResponse<T = unknown> {
  public readonly success: boolean;
  public readonly message: string;
  public readonly data?: T;

  constructor(statusCode: number, data?: T, message = "Success") {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}
