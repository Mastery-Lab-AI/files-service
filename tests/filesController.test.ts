import express from "express";
import request from "supertest";

jest.mock("../src/lib/supabase", () => {
  return {
    supabaseAnon: { auth: { getUser: jest.fn() } },
    supabase: jest.fn(),
  };
});

import { supabaseAnon, supabase } from "../src/lib/supabase";
import { FilesController } from "../src/controllers/filesController";
import { authenticateUser } from "../src/middleware/authenticateUser";

describe("POST /files", () => {
  const app = express();
  app.use(express.json());
  const controller = new FilesController();
  app.post("/files", authenticateUser, controller.createFile.bind(controller));

  const uuid = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects invalid workspace_id", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1", user_metadata: { student_id: "stu-1" } } }, error: null });

    const res = await request(app)
      .post("/files")
      .set("Authorization", "Bearer valid")
      .send({ workspace_id: "not-a-uuid", name: "Doc", type: "note" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect((supabase as jest.Mock)).not.toHaveBeenCalled();
  });

  it("rejects invalid type", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1", user_metadata: { student_id: "stu-1" } } }, error: null });

    const res = await request(app)
      .post("/files")
      .set("Authorization", "Bearer valid")
      .send({ workspace_id: uuid, name: "Doc", type: "file" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects empty name", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1", user_metadata: { student_id: "stu-1" } } }, error: null });

    const res = await request(app)
      .post("/files")
      .set("Authorization", "Bearer valid")
      .send({ workspace_id: uuid, name: " ", type: "note" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("creates file with studentId from auth.uid(), ignoring body student_id", async () => {
    (supabaseAnon.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: "u1", user_metadata: { student_id: "stu-good" } } }, error: null });

    const single = jest.fn().mockResolvedValue({
      data: {
        id: "file-1",
        type: "note",
        student_id: "u1",
        workspace_id: uuid,
        name: "Doc",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
      error: null,
    });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    (supabase as jest.Mock).mockReturnValue({ from });

    const res = await request(app)
      .post("/files")
      .set("Authorization", "Bearer valid")
      .send({ workspace_id: uuid, name: "Doc", type: "note", student_id: "evil" });

    expect(res.status).toBe(201);
    expect(res.body.studentId).toBe("u1");
    expect(from).toHaveBeenCalledWith("workspace_files");
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ workspace_id: uuid, student_id: "u1", type: "note", name: "Doc" })
    ]);
  });
});
