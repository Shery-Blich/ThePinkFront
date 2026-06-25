import { useState, useEffect } from 'react';
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from '../../api/questions.js';
import QuestionForm from '../components/QuestionForm.jsx';

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

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this question?')) return;
    await deleteQuestion(id);
    load();
  };

  if (loading) return <p>Loading...</p>;
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

      {questions.map((q) => (
        <div key={q._id} style={{ ...styles.card, opacity: q.isActive ? 1 : 0.5 }}>
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

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  card: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' },
  questionText: { fontWeight: 600, marginBottom: '0.5rem' },
  answerList: { paddingLeft: '1.5rem', paddingRight: '1.5rem', margin: '0 0 0.75rem' },
  correctAnswer: { color: '#155724', fontWeight: 600 },
  rowActions: { display: 'flex', gap: '0.5rem' },
  btnPrimary: { padding: '0.5rem 1rem', background: '#c2185b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnEdit: { padding: '0.3rem 0.8rem', background: '#e91e8c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnDelete: { padding: '0.3rem 0.8rem', background: '#f8bbd0', color: '#880e4f', border: 'none', borderRadius: '4px', cursor: 'pointer' },
};
