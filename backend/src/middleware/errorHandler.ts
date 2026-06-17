export class BusinessError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = "BUSINESS_ERROR", statusCode: number = 400) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: any, req: any, res: any, next: any) {
  console.error("[Error]", err.message, err.stack);

  if (err instanceof BusinessError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "服务器内部错误",
    code: "INTERNAL_ERROR",
  });
}
