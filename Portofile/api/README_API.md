 # Portfolio Projects API (Node + MongoDB)

## Overview
RESTful API for managing portfolio projects with bilingual fields, authentication (JWT), and filtering.

## Tech Stack
- Node.js / Express
- MongoDB / Mongoose
- JWT for auth
- bcrypt for password hashing
- CORS enabled for frontend consumption

## Environment Variables (.env)
```
MONGO_URI=your_mongo_connection_string
JWT_SECRET=long_random_secret_string
PORT=3001
```
Reference `.env.example`.

## Install & Run
```powershell
cd api
npm install
npm run dev
```
Server runs on `http://localhost:3001`.

## Models
### Project
Fields: user_id, title{ar,en}, slug, short_description{ar,en}, full_description{ar,en}, role{ar,en}, client_name, location{ar,en}, start_date, end_date, status, main_image_url, gallery[], tags[], openMode.

### User
Fields: email, passwordHash, name, role.

## Auth Endpoints
| Method | Endpoint           | Description            |
|--------|--------------------|------------------------|
| POST   | /api/auth/register | Create new user        |
| POST   | /api/auth/login    | Obtain JWT token       |

Register: `{ email, password, name }`
Login: `{ email, password }` returns `{ token }`.

## Project Endpoints
| Method | Endpoint                | Description                        |
|--------|-------------------------|------------------------------------|
| GET    | /api/projects           | List (filters: tag, status, search, page, limit) |
| GET    | /api/projects/:slug     | Single project detail              |
| POST   | /api/projects           | Create (auth required)             |
| PUT    | /api/projects/:slug     | Update (auth required)             |
| DELETE | /api/projects/:slug     | Delete (auth required)             |

## Image Upload Endpoint (Basic Level)
Single image upload (2MB limit, types: jpg/jpeg/png/webp) using `multer`.

| Method | Endpoint               | Description                |
|--------|------------------------|----------------------------|
| POST   | /api/upload/image      | Upload image (auth required) |

Form field name: `image`

Response:
```json
{ "url": "/uploads/1700859012345-a1b2c3d4e5f6.png", "name": "1700859012345-a1b2c3d4e5f6.png", "size": 54231 }
```

Example (PowerShell):
```powershell
curl -X POST -H "Authorization: Bearer $token" -F "image=@.\test-pixel.png" http://localhost:3001/api/upload/image
```

Use the returned `url` as `main_image_url` or inside `gallery`.

## Dynamic Database Switching
Admin route allows testing a new Mongo URI or applying it without server restart.

| Method | Endpoint                 | Description                                 |
|--------|--------------------------|---------------------------------------------|
| POST   | /api/admin/db-config     | Test or switch active Mongo connection      |

Payload:
```json
{ "mongoUri": "mongodb+srv://user:pass@cluster/dbname", "testOnly": true }
```
- When `testOnly` = true: tries connection and returns `{ ok: true, testOnly: true }` if reachable.
- When `testOnly` = false: closes current connection and switches to new URI:
```json
{ "ok": true, "previous": "oldUri", "current": "newUri", "changed": true }
```

Headers: `Authorization: Bearer <JWT>` required (must be logged in).

### Notes & Safety
- If same URI provided: `{ changed: false, reason: "same-uri" }`.
- Keep a record of previous URI externally for rollback.
- Recommended to restrict this route to admin users only (extend user role logic).
- For production, consider persisting active URI in a `settings` collection.

### Manual Test Flow
1. Login and capture `$token`.
2. Test new URI: POST with `testOnly: true`.
3. Apply: POST without `testOnly` or with `testOnly: false`.
4. Verify `/api/health` still returns `ok` and CRUD still works.


### Listing
Query params:
- `tag=Construction`
- `status=completed`
- `search=villa`
- `page=1`
- `limit=20`

Response:
```
{
  "total": 42,
  "page": 1,
  "items": [ { id, slug, title, short_description, status, main_image_url, tags, start_date, location } ]
}
```

### Create Example
```json
{
  "title": {"ar": "مشروع فلل لافندر", "en": "Lavender Villas"},
  "slug": "lavender-villas",
  "short_description": {"ar": "تصميم وتنفيذ فلل", "en": "Design & build villas"},
  "full_description": {"ar": "تفاصيل كاملة للمشروع...", "en": "Full project details..."},
  "role": {"ar": "مدير مشروع", "en": "Project Manager"},
  "client_name": "شركة ديار",
  "location": {"ar": "الرياض", "en": "Riyadh"},
  "start_date": "2024-01-10",
  "status": "completed",
  "main_image_url": "https://cdn.example.com/projects/lavender/cover.jpg",
  "gallery": ["https://cdn.example.com/projects/lavender/1.jpg"],
  "tags": ["Construction", "Residential"],
  "openMode": "modal"
}
```

Header for protected routes:
`Authorization: Bearer <JWT>`

## Security Notes
- Use HTTPS in production.
- Rotate `JWT_SECRET` periodically.
- Enforce strong password rules client-side.

## Next Steps / Enhancements
- Rate limiting (express-rate-limit).
- Multi-image upload integration (Cloudinary/S3 pre-signed URLs).
- Role-based access (editor vs admin).
- Cache layer (Redis) for GET /projects.
- Text search index for descriptions.
- Audit logs (create/update/delete).
- Automatic cleanup for orphaned uploaded files (future).
- Thumbnail generation & WebP conversion (sharp).
- Env override fallback if dynamic switch fails.

## Frontend Integration Outline
1. After login store token in `localStorage`.
2. Fetch list: `fetch('/api/projects')`.
3. Fetch detail by slug for modal or separate page.
4. Admin panel: replace JSON save with POST/PUT calls.

---
MIT-style usage; adapt as needed.
