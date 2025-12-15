# Files Service Overview

## 1. Introduction

The Files Service is responsible for managing user-uploaded content (files) and user-created notes. It abstracts the storage details (Google Cloud Storage) and provides a structured API for the frontend and other services to interact with file data.

## 2. Technology Stack

*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Storage**: Google Cloud Storage (for blobs), Supabase (for metadata/DB).

## 3. Architecture

The service exposes a REST API.
-   **Routers**: `fileRouter` (generic files), `workspaceRouter` (workspace-scoped content).
-   **Controllers**: `FilesController` handles the business logic.
-   **Middleware**: `authenticateUser` ensures all requests are authorized via Supabase JWT.

## 4. API Reference

### 4.1. Files & Notes

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/files` | Upload a new file. |
| `GET` | `/files/notes` | List all notes for the authenticated user. |
| `POST` | `/files/notes` | Create a new note. |
| `GET` | `/files/notes/:noteId` | Get a specific note. |
| `PUT` | `/files/notes/:noteId` | Update a note (content/title). |
| `DELETE` | `/files/notes/:noteId` | Delete a note. |

### 4.2. Workspace Resources

Endpoints prefixed with `/workspace/:workspaceId`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/files` | List files in the workspace (filter by `type` query param). |
| `POST` | `/files` | Create a file in the workspace. |
| `GET` | `/files/:fileId/content` | Get raw file content. |
| `PUT` | `/files/:fileId/content` | Update raw file content. |
| `GET` | `/notes/:noteId/content` | Get content of a note in the workspace. |
| `PUT` | `/notes/:noteId/content` | Update content of a note in the workspace. |

## 5. Setup

1.  **Install**: `npm install`
2.  **Environment**:
    ```env
    PORT=8080
    SUPABASE_URL=...
    GOOGLE_CLOUD_PROJECT=...
    GCS_BUCKET_NAME=...
    ```
3.  **Run**: `npm start` or `npm run dev`.
