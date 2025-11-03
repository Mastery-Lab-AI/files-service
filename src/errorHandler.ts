import {NextFunction, Request, Response} from "express";

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = typeof error?.status === 'number' ? error.status : 500;
  const message = error?.message || 'Internal Server Error';
  res.status(status).json({ success: false, error: message });
};
