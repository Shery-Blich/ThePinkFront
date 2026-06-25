import mongoose from 'mongoose';

const answerRecordSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    chosenAnswerIndex: { type: Number, required: true, min: 0, max: 3 },
    isCorrect: { type: Boolean, required: true },
    timeSpentMs: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const gameSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    answers: [answerRecordSchema],
    totalQuestions: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
  },
  { timestamps: false }
);

export default mongoose.model('GameSession', gameSessionSchema);
