import { useState, useEffect } from 'react';
import {
  getQuestions, createQuestion, updateQuestion, deleteQuestion, reorderQuestions,
} from '../../api/questions.js';
import QuestionForm from '../components/QuestionForm.jsx';

// The game asks one active question per stage, in list order (Game/systems/level-trivia.js)
const GAME_SLOTS = ['Kiryat Shmona', 'Supermarket', 'The ride', 'Kotel', 'Ballot box'];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getQuestions()
      .then(setQuestions)
      .catch(() => setError('Failed to load questions'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      await createQuestion(data);
      setShowNew(false);
      load();
    } catch (e) {
      alert(e.response?.data?.errors?.[0]?.msg || 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setSaving(true);
    try {
      await updateQuestion(id, data);
      setEditingId(null);
      load();
    } catch (e) {
      alert(e.response?.data?.errors?.[0]?.msg || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const previous = questions;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
    try {
      await reorderQuestions(next.map((q) => q._id));
    } catch {
      setQuestions(previous);
      alert('Failed to save the new order');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this question?')) return;
    await deleteQuestion(id);
    load();
  };

  if (loading) return <p>Loading...</p>;

  // Position among active questions decides which stage asks it
  const activeIds = questions.filter((q) => q.isActive).map((q) => q._id);
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Questions ({questions.length})</h2>
        <button style={styles.btnPrimary} onClick={() => setShowNew(!showNew)}>
          {showNew ? 'Cancel' : '+ New Question'}
        </button>
      </div>

      {showNew && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>New Question</h3>
          <QuestionForm onSubmit={handleCreate} onCancel={() => setShowNew(false)} loading={saving} />
        </div>
      )}

      {questions.length === 0 && <p>No questions yet. Create one above.</p>}

      {questions.map((q, index) => (
        <div key={q._id} style={{ ...styles.card, opacity: q.isActive ? 1 : 0.5 }}>
          <div style={styles.cardTop}>
            <span style={styles.position}>#{index + 1}</span>
            <GameSlot slot={activeIds.indexOf(q._id)} />
            <div style={styles.moveButtons}>
              <button
                style={{ ...styles.btnMove, ...(index === 0 && styles.btnMoveDisabled) }}
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                title="Move up"
              >
                ↑
              </button>
              <button
                style={{ ...styles.btnMove, ...(index === questions.length - 1 && styles.btnMoveDisabled) }}
                onClick={() => handleMove(index, 1)}
                disabled={index === questions.length - 1}
                aria-label="Move down"
                title="Move down"
              >
                ↓
              </button>
            </div>
          </div>
          {editingId === q._id ? (
            <>
              <h3 style={{ marginTop: 0 }}>Edit Question</h3>
              <QuestionForm
                initial={{ text: q.text, answers: q.answers, correctAnswerIndex: q.correctAnswerIndex }}
                onSubmit={(data) => handleUpdate(q._id, data)}
                onCancel={() => setEditingId(null)}
                loading={saving}
              />
            </>
          ) : (
            <>
              <p style={styles.questionText} dir="auto">{q.text}</p>
              <ol style={styles.answerList} dir="auto">
                {q.answers.map((a, i) => (
                  <li key={i} dir="auto" style={i === q.correctAnswerIndex ? styles.correctAnswer : undefined}>
                    {a.text}
                  </li>
                ))}
              </ol>
              <div style={styles.rowActions}>
                <button style={styles.btnEdit} onClick={() => setEditingId(q._id)}>Edit</button>
                <button style={styles.btnDelete} onClick={() => handleDelete(q._id)}>
                  {q.isActive ? 'Deactivate' : 'Deactivated'}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function GameSlot({ slot }) {
  if (slot === -1) return <span style={styles.slotMuted}>Inactive · not in the game</span>;
  if (slot >= GAME_SLOTS.length) {
    return <span style={styles.slotWarn}>Not shown · the game only has {GAME_SLOTS.length} question stages</span>;
  }
  return <span style={styles.slot}>In game: question {slot + 1} · {GAME_SLOTS[slot]}</span>;
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  card: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' },
  cardTop: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' },
  position: { fontWeight: 700, color: '#880e4f' },
  slot: { fontSize: '0.8rem', color: '#555', background: '#fce4ec', borderRadius: '999px', padding: '0.1rem 0.6rem' },
  slotMuted: { fontSize: '0.8rem', color: '#777', background: '#f1f1f1', borderRadius: '999px', padding: '0.1rem 0.6rem' },
  slotWarn: { fontSize: '0.8rem', color: '#8a4b00', background: '#fff3e0', borderRadius: '999px', padding: '0.1rem 0.6rem' },
  moveButtons: { display: 'flex', gap: '0.25rem', marginLeft: 'auto' },
  btnMove: { width: '2rem', height: '2rem', background: '#fff', color: '#880e4f', border: '1px solid #f8bbd0', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' },
  btnMoveDisabled: { opacity: 0.35, cursor: 'default' },
  questionText: { fontWeight: 600, marginBottom: '0.5rem' },
  answerList: { paddingLeft: '1.5rem', paddingRight: '1.5rem', margin: '0 0 0.75rem' },
  correctAnswer: { color: '#880e4f', fontWeight: 600 },
  rowActions: { display: 'flex', gap: '0.5rem' },
  btnPrimary: { padding: '0.5rem 1rem', background: '#c2185b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnEdit: { padding: '0.3rem 0.8rem', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnDelete: { padding: '0.3rem 0.8rem', background: '#f8bbd0', color: '#880e4f', border: 'none', borderRadius: '4px', cursor: 'pointer' },
};
