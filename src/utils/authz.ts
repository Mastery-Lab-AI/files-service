import { AuthzRequest } from "../types/authz";

export function requireAuthenticatedUser(req: AuthzRequest) {
  const userId = req.userId;
  const studentId = req.studentId;
  if (!userId || !studentId) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return { userId, studentId };
}

