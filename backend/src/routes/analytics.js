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

// A session that hasn't completed counts as abandoned once the player closed
// the tab, or after this long with no activity; newer ones may still be mid-game.
const IDLE_CUTOFF_MINUTES = 30;

// Aggregation expression: true when an unfinished session has been closed or gone idle
const isAbandoned = (cutoff) => ({
  $and: [
    { $ne: ['$completed', true] },
    {
      $or: [
        { $lt: ['$lastActivityAt', cutoff] },
        { $gte: [{ $ifNull: ['$leftAt', null] }, '$lastActivityAt'] },
      ],
    },
  ],
});

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
          abandoned: { $sum: { $cond: [isAbandoned(cutoff), 1, 0] } },
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

// Days are bucketed in local time so the chart lines up with when posts went out
const TIMEZONE = 'Asia/Jerusalem';

// Group sessions by a field and count how many of each finished the game
const breakdownBy = (field) => [
  { $group: { _id: { $ifNull: [field, 'unknown'] }, sessions: { $sum: 1 }, completed: { $sum: { $cond: ['$completed', 1, 0] } } } },
  { $project: { _id: 0, key: '$_id', sessions: 1, completed: 1 } },
  { $sort: { sessions: -1 } },
];

// Calendar dates from first to last inclusive, so days with no players show as 0
function fillDays(rows) {
  if (rows.length === 0) return [];
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const days = [];
  const end = new Date(`${rows[rows.length - 1].day}T00:00:00Z`);
  for (let d = new Date(`${rows[0].day}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    days.push(byDay[day] ?? { day, started: 0, completed: 0 });
  }
  return days;
}

// GET /api/analytics/overview — players over time, score spread, retries vs quitting, sources
router.get('/overview', requireAdmin, async (_req, res) => {
  const cutoff = new Date(Date.now() - IDLE_CUTOFF_MINUTES * 60 * 1000);

  const [timeline, scores, retries, [sources]] = await Promise.all([
    GameSession.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: TIMEZONE } },
          started: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
        },
      },
      { $project: { _id: 0, day: '$_id', started: 1, completed: 1 } },
      { $sort: { day: 1 } },
    ]),
    GameSession.aggregate([
      { $match: { completed: true, totalQuestions: { $gt: 0 } } },
      { $group: { _id: '$correctCount', sessions: { $sum: 1 }, maxQuestions: { $max: '$totalQuestions' } } },
      { $project: { _id: 0, correct: '$_id', sessions: 1, maxQuestions: 1 } },
      { $sort: { correct: 1 } },
    ]),
    // For each stage: players who lost it N times, and whether they then got past it or quit there
    GameSession.aggregate([
      { $match: { 'stageFailures.0': { $exists: true } } },
      { $addFields: { abandoned: isAbandoned(cutoff) } },
      { $unwind: '$stageFailures' },
      {
        $group: {
          _id: { session: '$_id', stage: '$stageFailures.stage' },
          losses: { $sum: 1 },
          lastStage: { $first: '$lastStage' },
          completed: { $first: '$completed' },
          abandoned: { $first: '$abandoned' },
        },
      },
      {
        $addFields: {
          stuckHere: { $and: [{ $ne: ['$completed', true] }, { $eq: ['$lastStage', '$_id.stage'] }] },
        },
      },
      {
        $group: {
          _id: { stage: '$_id.stage', losses: { $min: ['$losses', 3] } },
          players: { $sum: 1 },
          quit: { $sum: { $cond: [{ $and: ['$stuckHere', '$abandoned'] }, 1, 0] } },
          stillPlaying: { $sum: { $cond: [{ $and: ['$stuckHere', { $not: '$abandoned' }] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          stage: '$_id.stage',
          losses: '$_id.losses',
          players: 1,
          quit: 1,
          stillPlaying: 1,
          passed: { $subtract: ['$players', { $add: ['$quit', '$stillPlaying'] }] },
        },
      },
      { $sort: { stage: 1, losses: 1 } },
    ]),
    GameSession.aggregate([
      { $match: { source: { $exists: true } } },
      {
        $facet: {
          total: [{ $count: 'n' }],
          channel: breakdownBy('$source.channel'),
          deviceType: breakdownBy('$source.deviceType'),
          os: breakdownBy('$source.os'),
          browser: breakdownBy('$source.browser'),
          campaign: [{ $match: { 'source.utmCampaign': { $exists: true } } }, ...breakdownBy('$source.utmCampaign')],
        },
      },
    ]),
  ]);

  res.json({
    timezone: TIMEZONE,
    timeline: fillDays(timeline),
    scores,
    retries,
    sources: { ...sources, total: sources.total[0]?.n ?? 0 },
  });
});

export default router;
