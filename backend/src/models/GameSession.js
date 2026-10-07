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

const stageFailureSchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    failedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const linkClickSchema = new mongoose.Schema(
  {
    linkType: { type: String, required: true },
    clickedAt: { type: Date, default: Date.now },
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
    // Funnel tracking: the furthest stage the player reached and whether they
    // finished the whole game. A session that is not completed and has been
    // idle for a while is treated as having dropped off at lastStage.
    lastStage: { type: String },
    lastStageIndex: { type: Number },
    lastActivityAt: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false },
    stageFailures: [stageFailureSchema],
    linkClicks: [linkClickSchema],
  },
  { timestamps: false }
);

export default mongoose.model('GameSession', gameSessionSchema);
