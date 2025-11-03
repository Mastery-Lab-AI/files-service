import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabaseAnon = createClient(supabaseUrl, supabaseKey);

export const supabase = (token: string) =>
  createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

// Optional service role client for server-side privileged operations
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseService = () =>
  serviceKey ? createClient(supabaseUrl, serviceKey) : undefined;
