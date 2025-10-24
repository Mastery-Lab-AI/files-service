import { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../lib/supabase";

// Chat-history style authentication adapted for files-service
// - Skips OPTIONS
// - Validates Bearer token
// - Verifies JWT with Supabase
// - Attaches user, userId, and studentId to request
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
