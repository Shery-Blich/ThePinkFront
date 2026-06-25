import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Admin', adminSchema);
