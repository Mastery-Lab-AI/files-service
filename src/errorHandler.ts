import {NextFunction, Request, Response} from "express";

export const errorHandler = (
  error: Error,
  _: Request,
  res: Response,
  next: NextFunction
) => {
  next(error);
}