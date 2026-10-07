import { Router } from 'express';
import { body, param } from 'express-validator';
import Question, { QUESTION_SORT } from '../models/Question.js';
import GameSession from '../models/GameSession.js';
import { handleValidationErrors } from '../middleware/validate.js';
import { buildSessionSource } from '../lib/sessionSource.js';

const router = Router();

// Caps on per-session arrays so a misbehaving client can't grow a document unbounded
const MAX_FAILURES = 200;
const MAX_LINK_CLICKS = 100;
const STAGE_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const LINK_TYPES = ['share', 'share_completed', 'instagram', 'official_voting_info', 'itch_games'];

// GET /api/game/questions — public, correctAnswerIndex is intentionally omitted
router.get('/questions', async (_req, res) => {
  const questions = await Question.find({ isActive: true })
    .sort(QUESTION_SORT)
    .select('_id text answers')
    .lean();
  res.json(questions);
});

// POST /api/game/sessions — start a new anonymous session
router.post(
  '/sessions',
  body('sessionId').isUUID(),
  body('referrer').optional().isString().isLength({ max: 2000 }),
  body(['utmSource', 'utmMedium', 'utmCampaign']).optional().isString().isLength({ max: 200 }),
  body('orientation').optional().isIn(['portrait', 'landscape']),
  body(['screenWidth', 'screenHeight']).optional().isInt({ min: 0, max: 20000 }).toInt(),
  body('isTouch').optional().isBoolean().toBoolean(),
  handleValidationErrors,
  async (req, res) => {
    const existing = await GameSession.findOne({ sessionId: req.body.sessionId });
    if (existing) return res.status(409).json({ error: 'Session already exists' });

    const session = await GameSession.create({
      sessionId: req.body.sessionId,
      source: buildSessionSource(req),
    });
    res.status(201).json({ id: session._id, sessionId: session.sessionId });
  }
);

// POST /api/game/sessions/:id/answer
router.post(
  '/sessions/:id/answer',
  param('id').isMongoId(),
  body('questionId').isMongoId(),
  body('chosenAnswerIndex').isInt({ min: 0, max: 3 }),
  body('timeSpentMs').isInt({ min: 0 }),
  handleValidationErrors,
  async (req, res) => {
    const session = await GameSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.endedAt) return res.status(400).json({ error: 'Session already ended' });

    const question = await Question.findById(req.body.questionId).select('correctAnswerIndex').lean();
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const isCorrect = question.correctAnswerIndex === req.body.chosenAnswerIndex;

    session.answers.push({
      questionId: req.body.questionId,
      chosenAnswerIndex: req.body.chosenAnswerIndex,
      isCorrect,
      timeSpentMs: req.body.timeSpentMs,
    });
    session.totalQuestions += 1;
    if (isCorrect) session.correctCount += 1;
    session.lastActivityAt = new Date();
    await session.save();

    res.json({ isCorrect, correctAnswerIndex: question.correctAnswerIndex });
  }
);

// POST /api/game/sessions/:id/progress — player started a stage
router.post(
  '/sessions/:id/progress',
  param('id').isMongoId(),
  body('stage').matches(STAGE_KEY),
  body('stageIndex').isInt({ min: 0, max: 50 }),
  handleValidationErrors,
  async (req, res) => {
    const result = await GameSession.updateOne(
      { _id: req.params.id },
      {
        $set: {
          lastStage: req.body.stage,
          lastStageIndex: req.body.stageIndex,
          lastActivityAt: new Date(),
        },
      }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  }
);

// POST /api/game/sessions/:id/failure — player lost a stage (they may retry it)
router.post(
  '/sessions/:id/failure',
  param('id').isMongoId(),
  body('stage').matches(STAGE_KEY),
  handleValidationErrors,
  async (req, res) => {
    const result = await GameSession.updateOne(
      { _id: req.params.id },
      {
        $push: { stageFailures: { $each: [{ stage: req.body.stage }], $slice: -MAX_FAILURES } },
        $set: { lastActivityAt: new Date() },
      }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  }
);

// POST /api/game/sessions/:id/link — player clicked an end-screen link.
// Allowed after the session ended, since the end screen is shown post-game.
router.post(
  '/sessions/:id/link',
  param('id').isMongoId(),
  body('linkType').isIn(LINK_TYPES),
  handleValidationErrors,
  async (req, res) => {
    const result = await GameSession.updateOne(
      { _id: req.params.id },
      {
        $push: { linkClicks: { $each: [{ linkType: req.body.linkType }], $slice: -MAX_LINK_CLICKS } },
        $set: { lastActivityAt: new Date() },
      }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  }
);

// POST /api/game/sessions/:id/leave — player closed the tab mid-game
router.post(
  '/sessions/:id/leave',
  param('id').isMongoId(),
  handleValidationErrors,
  async (req, res) => {
    // No-op for finished sessions, so closing the end screen isn't a drop-off
    await GameSession.updateOne({ _id: req.params.id, completed: false }, { $set: { leftAt: new Date() } });
    res.status(204).end();
  }
);

// POST /api/game/sessions/:id/end — player finished the whole game
router.post(
  '/sessions/:id/end',
  param('id').isMongoId(),
  handleValidationErrors,
  async (req, res) => {
    const now = new Date();
    const session = await GameSession.findByIdAndUpdate(
      req.params.id,
      { endedAt: now, lastActivityAt: now, completed: true },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({
      totalQuestions: session.totalQuestions,
      correctCount: session.correctCount,
    });
  }
);

export default router;
