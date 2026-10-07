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
    // Position set from the admin panel; the game asks active questions in this order
    order: { type: Number },
  },
  { timestamps: true }
);

// Questions created before ordering existed have no `order` and sort first, by creation date
export const QUESTION_SORT = { order: 1, createdAt: 1 };

export default mongoose.model('Question', questionSchema);
