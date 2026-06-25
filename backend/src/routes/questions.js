import { Router } from 'express';
import { body, param } from 'express-validator';
import Question from '../models/Question.js';
import { requireAdmin } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validate.js';

const router = Router();

const questionValidators = [
  body('text').isString().trim().notEmpty().isLength({ max: 1000 }),
  body('answers').isArray({ min: 4, max: 4 }),
  body('answers.*.text').isString().trim().notEmpty().isLength({ max: 300 }),
  body('correctAnswerIndex').isInt({ min: 0, max: 3 }),
];

// GET /api/questions  — admin: full data including correctAnswerIndex
router.get('/', requireAdmin, async (_req, res) => {
  const questions = await Question.find().sort({ createdAt: 1 }).lean();
  res.json(questions);
});

// POST /api/questions
router.post('/', requireAdmin, questionValidators, handleValidationErrors, async (req, res) => {
  const { text, answers, correctAnswerIndex } = req.body;
  const question = await Question.create({ text, answers, correctAnswerIndex });
  res.status(201).json(question);
});

// PUT /api/questions/:id
router.put(
  '/:id',
  requireAdmin,
  param('id').isMongoId(),
  questionValidators,
  handleValidationErrors,
  async (req, res) => {
    const { text, answers, correctAnswerIndex, isActive } = req.body;
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { text, answers, correctAnswerIndex, ...(isActive !== undefined && { isActive }) },
      { new: true, runValidators: true }
    );
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json(question);
  }
);

// DELETE /api/questions/:id  — soft delete
router.delete(
  '/:id',
  requireAdmin,
  param('id').isMongoId(),
  handleValidationErrors,
  async (req, res) => {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deactivated', id: question._id });
  }
);

export default router;
