import { Router } from 'express';
import GameSession from '../models/GameSession.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/analytics/questions — per-question stats
router.get('/questions', requireAdmin, async (_req, res) => {
  const stats = await GameSession.aggregate([
    { $unwind: '$answers' },
    {
      $group: {
        _id: '$answers.questionId',
        totalAnswers: { $sum: 1 },
        correctCount: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
        answerDistribution: {
          $push: '$answers.chosenAnswerIndex',
        },
        avgTimeSpentMs: { $avg: '$answers.timeSpentMs' },
      },
    },
    {
      $addFields: {
        correctRate: {
          $cond: [
            { $gt: ['$totalAnswers', 0] },
            { $divide: ['$correctCount', '$totalAnswers'] },
            0,
          ],
        },
        // Count how many times each option (0-3) was chosen
        distribution: {
          $map: {
            input: [0, 1, 2, 3],
            as: 'idx',
            in: {
              $size: {
                $filter: {
                  input: '$answerDistribution',
                  as: 'a',
                  cond: { $eq: ['$$a', '$$idx'] },
                },
              },
            },
          },
        },
      },
    },
    { $project: { answerDistribution: 0 } },
    {
      $lookup: {
        from: 'questions',
        localField: '_id',
        foreignField: '_id',
        as: 'question',
      },
    },
    { $unwind: { path: '$question', preserveNullAndEmpty: true } },
    {
      $project: {
        questionId: '$_id',
        questionText: '$question.text',
        totalAnswers: 1,
        correctCount: 1,
        correctRate: 1,
        distribution: 1,
        avgTimeSpentMs: 1,
      },
    },
  ]);

  res.json(stats);
});

// GET /api/analytics/sessions — session-level stats
router.get('/sessions', requireAdmin, async (_req, res) => {
  const sessions = await GameSession.find({ endedAt: { $exists: true } })
    .select('sessionId startedAt endedAt totalQuestions correctCount')
    .lean();

  const total = sessions.length;
  const avgScore =
    total > 0
      ? sessions.reduce((sum, s) => sum + (s.totalQuestions > 0 ? s.correctCount / s.totalQuestions : 0), 0) / total
      : 0;

  res.json({ total, avgScore, sessions });
});

export default router;
