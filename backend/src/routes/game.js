import { Router } from 'express';
import { body, param } from 'express-validator';
import Question from '../models/Question.js';
import GameSession from '../models/GameSession.js';
import { handleValidationErrors } from '../middleware/validate.js';

const router = Router();

// GET /api/game/questions — public, correctAnswerIndex is intentionally omitted
router.get('/questions', async (_req, res) => {
  const questions = await Question.find({ isActive: true })
    .select('_id text answers')
    .lean();
  res.json(questions);
});

// POST /api/game/sessions — start a new anonymous session
router.post(
  '/sessions',
  body('sessionId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    const existing = await GameSession.findOne({ sessionId: req.body.sessionId });
    if (existing) return res.status(409).json({ error: 'Session already exists' });

    const session = await GameSession.create({ sessionId: req.body.sessionId });
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
    await session.save();

    res.json({ isCorrect });
  }
);

// POST /api/game/sessions/:id/end
router.post(
  '/sessions/:id/end',
  param('id').isMongoId(),
  handleValidationErrors,
  async (req, res) => {
    const session = await GameSession.findByIdAndUpdate(
      req.params.id,
      { endedAt: new Date() },
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
