# Site Guide (Concise EN Version) - 2025-11-25

This short document summarizes the architecture and usage of the portfolio site.

---
## 1. Overview
- Static site: pure HTML/CSS/Vanilla JS.
- Single content source: `content.json` at project root.
- Two main pages: `index.html` (public) and `admin.html` (content editing).
- Arabic / English language toggle via `data-ar` / `data-en` attributes and CMS bilingual fields.

---
## 2. Architecture Layers
1. Presentation: Semantic HTML + `data-*` attributes for CMS injection.
2. Data: JSON file (video, hero, sections, certificates, projects arrays).
3. Logic:
   - `script.js`: fetch, apply CMS, build marquee (projects & certificates), gallery modal, language switching, hero video.
   - `admin.js`: authentication (simple), load & bind form, add/edit/delete certificates & projects, drag & drop reorder, export JSON.
4. Styles: `style.css` with theme variables (`:root`), responsive layouts, card & modal design, marquee wrappers.

---
## 3. Data Flow
```
content.json --> fetch --> window.CMS_CONTENT --> applyCMS --> DOM
                                 |--> initProjects() (duplicate list for marquee)
                                 |--> applyCertificates() (duplicate list for marquee)
```
Marquee uses duplicated DOM set + `requestAnimationFrame` horizontal translation for seamless looping.

---
## 4. Key Features
- Hero: optional background video (YouTube or MP4), toggle play/pause button.
- Certificates & Projects: continuous auto-scroll (marquee) with hover pause.
- Projects: click opens gallery modal with slides, thumbnails, keyboard navigation (RTL aware).
- Language switching: instant swap of text & direction (RTL/LTR).
- Reduced motion respect: disables typing animation if user prefers reduced motion.
- Notifications & meeting modal: lightweight UI components.

---
## 5. Admin Panel Usage
1. Login (password in `admin.js` constant `ADMIN_PASSWORD` – change before deployment).
2. Click "Load" to fetch current JSON.
3. Edit hero / video / sections / certificates / projects.
4. Add new certificate/project via buttons; project gallery: each line = image URL.
5. Drag & drop reorder: grab the handle (⋮⋮) on certificates or projects to rearrange.
6. Click "Save as JSON" → download file → replace `assets/data/content.json`.

Unsaved changes tracking: any input change marks state dirty; leaving page warns user.

---
## 6. Drag & Drop Reordering
- Implemented for certificates and projects.
- DOM order = export order.
- After dragging, labels renumber automatically (Certificate # / Project #).
- Always export and replace JSON to apply changes on live site.
### Extras (Now Added)
- Up/Down buttons per card for precise reorder.
- Keyboard shortcut: Alt + ArrowUp / Alt + ArrowDown when card focused.
- Undo delete banner: deleting a card shows a bottom popup with "Undo" to restore last removed item.
- Automatic renumber after move or undo.
Limitations: only last deleted item can be restored (no multi-history).

---
## 7. Quick Local Save & Delete Warning
### Quick Save
Button "Quick Save" stores a draft of current content into `localStorage` (`CMS_CONTENT_DRAFT`). A restore prompt appears next time you open the admin panel if a draft exists.
Use it for iterative editing before exporting the final JSON.

Notes:
- Only one draft (overwritten each time).
- Draft is not deployed; you must still export & replace `content.json`.
- Restoring a draft clears the dirty state.

### Delete Burst Warning
If you delete 4 items without saving a temporary floating warning suggests saving to prevent data loss. Counter resets after any save action (file/system/local).

### Save Types Comparison
| Type | Storage | Requires file replace | Use Case |
|------|---------|-----------------------|----------|
| File Export | Download | Yes | Final publish |
| Direct Save (FS API) | Chosen file | No (if same file) | Fast update (supported browsers) |
| Quick Save | localStorage | Yes | Mid-session draft |

### Future Ideas
- Timestamp display for draft.
- Multiple draft slots.
- Cloud sync (needs backend).


---
## 7. Performance Notes
- `requestAnimationFrame` for marquee (fine-grained speed, no CSS gap issues).
- Duplicate list pattern prevents end/start gap.
- Lazy loading (`loading="lazy"`) for images.
- External image hosting recommended (Unsplash or CDN) to reduce bundle size.
- GPU-friendly transforms (`will-change: transform`) for marquee containers.

---
## 8. Security Caveats
- Password is client-side (visible). For production: protect `admin.html` behind server auth / reverse proxy.
- Do not store sensitive data in `content.json`.

---
## 9. Extensibility Ideas
- ID uniqueness validation (warn on duplicates).
- Image preview live for thumbnail/gallery fields.
- Adjustable marquee speed stored in JSON (e.g., `settings.marqueeSpeed`).
- Keyboard reordering & accessibility improvements.
- Backend API for persistent editing without manual file replacement.

---
## 10. Quick Add Examples
Certificate object:
```json
{
  "title": {"ar": "ماجستير إدارة مشاريع", "en": "Master Project Management"},
  "subtitle": {"ar": "MBA", "en": "MBA"},
  "year": "2025",
  "imageUrl": "https://.../certificate.png",
  "icon": "medal"
}
```
Project object:
```json
{
  "id": "project-4",
  "title": {"ar": "مركز طبي حديث", "en": "Modern Medical Center"},
  "description": {"ar": "تنفيذ وتجهيز مركز طبي", "en": "Execution & outfitting of medical center"},
  "category": {"ar": "صحي", "en": "Healthcare"},
  "year": "2024",
  "location": {"ar": "الرياض", "en": "Riyadh"},
  "thumbnail": "https://.../thumb.jpg",
  "gallery": ["https://.../g1.jpg", "https://.../g2.jpg"]
}
```

---
## 11. Theming Quick Change
Update primary accents in `style.css` under `:root` (e.g., `--accent-blue`, `--card-bg`). Minimal edits propagate globally.

---
## 12. Troubleshooting Snapshot
| Issue | Cause | Fix |
|-------|-------|-----|
| New project not showing | JSON file not replaced | Replace `content.json` and refresh |
| Marquee stutters | Large images not cached yet | Use optimized images / CDN |
| Subtitle not animating | Reduced motion preference or empty CMS field | Check OS accessibility settings / ensure field populated |
| Gallery empty | Missing gallery URLs | Add one URL per line |
| Drag reorder not reflected | JSON not saved/replaced | Export then overwrite file |

---
## 13. Deployment Tips
- Serve over HTTPS with caching (GZIP/Brotli for CSS/JS).
- Add server-level authentication for `admin.html`.
- Use a CDN for images and fonts.

---
## 14. Recap
Single JSON drives all dynamic content. Admin panel edits + drag reorder → export → replace file → refresh site. Marquee duplication ensures seamless scroll. Modal gallery and language toggle enhance UX.

End.
