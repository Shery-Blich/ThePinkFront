import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  { text: { type: String, required: true, trim: true, maxlength: 300 } },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    answers: {
      type: [answerSchema],
      validate: {
        validator: (arr) => arr.length === 4,
        message: 'A question must have exactly 4 answers.',
      },
    },
    correctAnswerIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Question', questionSchema);
