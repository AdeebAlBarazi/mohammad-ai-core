import express from 'express';
import { Project } from '../models/Project.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function toListProjection(doc){
  return {
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    short_description: doc.short_description,
    status: doc.status,
    main_image_url: doc.main_image_url,
    tags: doc.tags,
    start_date: doc.start_date,
    location: doc.location
  };
}

// GET /api/projects?tag=Construction&status=completed&page=1&limit=20
router.get('/', async (req,res)=>{
  try {
    const { tag, status, page=1, limit=20, search } = req.query;
    const filter = {};
    if(tag) filter.tags = tag;
    if(status) filter.status = status;
    if(search){
      // naive search in title (ar/en) & tags
      filter.$or = [
        { 'title.ar': { $regex: search, $options: 'i' } },
        { 'title.en': { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    const skip = (Number(page)-1) * Number(limit);
    const docs = await Project.find(filter).sort({ start_date: -1 }).skip(skip).limit(Number(limit));
    const total = await Project.countDocuments(filter);
    res.json({ total, page: Number(page), items: docs.map(toListProjection) });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Debug route returns full documents including gallery (DO NOT enable in production)
// Placed before slug route to avoid treating 'debug' as a slug
router.get('/debug/all', async (req,res)=>{
  try {
    const all = await Project.find({}).sort({ createdAt: -1 });
    res.json({ total: all.length, items: all });
  } catch(err){
    console.error('[DEBUG] projects list error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:slug
router.get('/:slug', async (req,res)=>{
  try {
    const doc = await Project.findOne({ slug: req.params.slug });
    if(!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects (auth)
router.post('/', authRequired, async (req,res)=>{
  try {
    const data = req.body;
    if(!data.slug) return res.status(400).json({ error: 'slug required' });
    data.user_id = req.user.uid;
    const exists = await Project.findOne({ slug: data.slug });
    if(exists) return res.status(409).json({ error: 'Slug already exists' });
    const created = await Project.create(data);
    console.log('[PROJECTS] Created', created.slug, 'gallery items:', Array.isArray(created.gallery)? created.gallery.length : 0, 'main_image:', created.main_image_url || '—');
    res.status(201).json({ id: created._id, slug: created.slug });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:slug (auth)
router.put('/:slug', authRequired, async (req,res)=>{
  try {
    const data = req.body;
    data.updated_at = new Date();
    const updated = await Project.findOneAndUpdate({ slug: req.params.slug }, data, { new: true });
    if(!updated) return res.status(404).json({ error: 'Not found' });
    console.log('[PROJECTS] Updated', updated.slug, 'gallery items:', Array.isArray(updated.gallery)? updated.gallery.length : 0, 'main_image:', updated.main_image_url || '—');
    res.json({ updated: true, slug: updated.slug });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:slug (auth)
router.delete('/:slug', authRequired, async (req,res)=>{
  try {
    const deleted = await Project.findOneAndDelete({ slug: req.params.slug });
    if(!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
