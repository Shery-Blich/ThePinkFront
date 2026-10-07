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
    { $unwind: { path: '$question', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        questionId: '$_id',
        questionText: '$question.text',
        answerTexts: '$question.answers.text',
        correctAnswerIndex: '$question.correctAnswerIndex',
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

// A session that hasn't completed and has had no activity for this long is
// considered abandoned; newer ones may still be mid-game.
const IDLE_CUTOFF_MINUTES = 30;

// GET /api/analytics/funnel — where players drop off, stage failures, end-link clicks
router.get('/funnel', requireAdmin, async (_req, res) => {
  const cutoff = new Date(Date.now() - IDLE_CUTOFF_MINUTES * 60 * 1000);
  // Sessions created before funnel tracking existed have no lastActivityAt
  const tracked = { lastActivityAt: { $exists: true } };

  const [stages, failures, links, totals] = await Promise.all([
    GameSession.aggregate([
      { $match: tracked },
      {
        $group: {
          _id: { stage: '$lastStage', stageIndex: '$lastStageIndex' },
          sessions: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
          abandoned: {
            $sum: { $cond: [{ $and: [{ $ne: ['$completed', true] }, { $lt: ['$lastActivityAt', cutoff] }] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          stage: { $ifNull: ['$_id.stage', null] },
          stageIndex: { $ifNull: ['$_id.stageIndex', -1] },
          sessions: 1,
          completed: 1,
          abandoned: 1,
          inProgress: { $subtract: ['$sessions', { $add: ['$completed', '$abandoned'] }] },
        },
      },
      { $sort: { stageIndex: 1 } },
    ]),
    GameSession.aggregate([
      { $match: tracked },
      { $unwind: '$stageFailures' },
      {
        $group: {
          _id: '$stageFailures.stage',
          failures: { $sum: 1 },
          sessionIds: { $addToSet: '$_id' },
        },
      },
      { $project: { _id: 0, stage: '$_id', failures: 1, sessions: { $size: '$sessionIds' } } },
    ]),
    GameSession.aggregate([
      { $match: tracked },
      { $unwind: '$linkClicks' },
      {
        $group: {
          _id: '$linkClicks.linkType',
          clicks: { $sum: 1 },
          sessionIds: { $addToSet: '$_id' },
        },
      },
      { $project: { _id: 0, linkType: '$_id', clicks: 1, sessions: { $size: '$sessionIds' } } },
      { $sort: { sessions: -1 } },
    ]),
    GameSession.aggregate([
      { $match: tracked },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
        },
      },
    ]),
  ]);

  res.json({
    idleCutoffMinutes: IDLE_CUTOFF_MINUTES,
    totalSessions: totals[0]?.total ?? 0,
    completedSessions: totals[0]?.completed ?? 0,
    stages,
    failures,
    links,
  });
});

export default router;
