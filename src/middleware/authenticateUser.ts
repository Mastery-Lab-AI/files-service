import { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../lib/supabase";

// Verifies Supabase user JWT and attaches req.studentId
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch?.[1]?.trim();

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) {
      console.warn("[auth] getUser failed", { message: error?.message, hasUser: !!data?.user });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = data.user;
    // Prefer explicit student_id in user_metadata; fall back to user.id
    const studentId = (user.user_metadata as any)?.student_id || user.id;

    // Attach to request for downstream handlers
    (req as any).studentId = String(studentId);

    return next();
  } catch (_e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
