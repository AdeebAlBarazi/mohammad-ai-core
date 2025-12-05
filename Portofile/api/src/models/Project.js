import mongoose from 'mongoose';

const localizedString = {
  ar: { type: String, trim: true },
  en: { type: String, trim: true }
};

const projectSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: localizedString,
  slug: { type: String, required: true, unique: true, trim: true },
  short_description: localizedString,
  full_description: localizedString,
  role: localizedString,
  client_name: { type: String, trim: true },
  location: localizedString,
  start_date: { type: Date },
  end_date: { type: Date },
  status: { type: String, enum: ['planned','in_progress','completed','paused','archived'], default: 'planned', index: true },
  main_image_url: { type: String, trim: true },
  // Gallery now supports objects with metadata; backward compatibility for strings handled in routes.
  gallery: [{
    url: { type: String, trim: true, required: true },
    title: localizedString,
    description: localizedString
  }],
  tags: [{ type: String, trim: true, index: true }],
  openMode: { type: String, enum: ['modal','page'], default: 'modal' }
},{ timestamps: true });

projectSchema.index({ status: 1, start_date: 1 });

export const Project = mongoose.model('Project', projectSchema);
