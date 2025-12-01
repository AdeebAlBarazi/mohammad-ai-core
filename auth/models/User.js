const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3 },
  fullName: { type: String, required: true },
  userType: { type: String, required: true, enum: ['buyer', 'seller', 'contractor', 'supplier'] },
  password: { type: String, required: true, minlength: 6 },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
  role: { type: String, enum: ['SuperAdmin', 'CompanyAdmin', 'ProjectManager', 'Engineer', 'Consultant', 'User'], default: 'User' }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
