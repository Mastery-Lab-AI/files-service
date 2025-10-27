import { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../lib/supabase";

// Auth middleware (aligned with chat-history with project-specific addition):
// - Skips OPTIONS
// - Requires an Authorization: Bearer <JWT>
// - Verifies the JWT using Supabase anon client
// - Attaches identity to request: user, userId, and studentId
//   NOTE: For SB-28 we always set studentId = auth.uid() (user.id)
//   to guarantee UUID alignment with RLS and schema.
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (req.method === "OPTIONS") return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error,
    } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const studentId = user.id;

    (req as any).user = { id: user.id, email: user.email };
    (req as any).userId = user.id;
    (req as any).studentId = String(studentId);

    return next();
  } catch (_e) {
    return res.status(500).json({ error: "Authentication failed" });
  }
}
