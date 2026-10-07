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

// Where the player came from and what they played on, captured at session start
const sourceSchema = new mongoose.Schema(
  {
    // Marketing channel: utm_source if given, else the in-app browser or referrer host, else 'direct'
    channel: { type: String },
    referrerHost: { type: String },
    utmSource: { type: String },
    utmMedium: { type: String },
    utmCampaign: { type: String },
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    os: { type: String },
    browser: { type: String },
    orientation: { type: String, enum: ['portrait', 'landscape'] },
    screenWidth: { type: Number },
    screenHeight: { type: Number },
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
    // Set when the player closed the tab. Later activity (bfcache restore) overrides it.
    leftAt: { type: Date },
    stageFailures: [stageFailureSchema],
    linkClicks: [linkClickSchema],
    source: { type: sourceSchema },
  },
  { timestamps: false }
);

export default mongoose.model('GameSession', gameSessionSchema);
