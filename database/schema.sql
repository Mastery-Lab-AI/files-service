-- files-service consolidated schema and policies (idempotent)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core table to track workspace files (notes, whiteboard, graph)
CREATE TABLE IF NOT EXISTS public.workspace_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note','whiteboard','graph')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_workspace_files_workspace ON public.workspace_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_student ON public.workspace_files(student_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_type ON public.workspace_files(type);
CREATE INDEX IF NOT EXISTS idx_workspace_files_updated_at ON public.workspace_files(updated_at DESC);

-- RLS
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

-- Users may read their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_files' AND policyname='Users can view own files'
  ) THEN
    CREATE POLICY "Users can view own files" ON public.workspace_files
      FOR SELECT USING (auth.uid() = student_id);
  END IF;
END$$;

-- Users may insert files for themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_files' AND policyname='Users can insert own files'
  ) THEN
    CREATE POLICY "Users can insert own files" ON public.workspace_files
      FOR INSERT WITH CHECK (auth.uid() = student_id);
  END IF;
END$$;

-- Users may update their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_files' AND policyname='Users can update own files'
  ) THEN
    CREATE POLICY "Users can update own files" ON public.workspace_files
      FOR UPDATE USING (auth.uid() = student_id);
  END IF;
END$$;

-- Users may delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_files' AND policyname='Users can delete own files'
  ) THEN
    CREATE POLICY "Users can delete own files" ON public.workspace_files
      FOR DELETE USING (auth.uid() = student_id);
  END IF;
END$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_files_updated_at ON public.workspace_files;
CREATE TRIGGER trg_workspace_files_updated_at
  BEFORE UPDATE ON public.workspace_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

