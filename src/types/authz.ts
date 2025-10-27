import type { Request } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export interface AuthzRequest<P = ParamsDictionary, I = any, Q = ParsedQs>
  extends Request<P, any, I, Q> {
  user?: {
    id: string;
    email?: string;
  };
  userId?: string;
  studentId?: string;
}

// export interface AuthzRequest<P = core.ParamsDictionary, I = undefined, Q = qs.ParsedQs> extends Request<P, undefined, I, Q> {
//   user?: {
//     id: string;
//     email?: string;
//   };
//   userId?: string;
//   studentId?: string;
// }
