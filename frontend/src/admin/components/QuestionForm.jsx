import { useState } from 'react';

const EMPTY_FORM = {
  text: '',
  answers: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
  correctAnswerIndex: 0,
};

export default function QuestionForm({ initial = EMPTY_FORM, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial);

  const setAnswer = (i, value) => {
    const answers = [...form.answers];
    answers[i] = { text: value };
    setForm({ ...form, answers });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label style={styles.label}>Question</label>
      <textarea
        style={styles.textarea}
        value={form.text}
        onChange={(e) => setForm({ ...form, text: e.target.value })}
        required
        maxLength={1000}
        rows={3}
        dir="auto"
      />

      <label style={styles.label}>Answers</label>
      {form.answers.map((ans, i) => (
        <div key={i} style={styles.answerRow}>
          <input
            type="radio"
            name="correct"
            checked={form.correctAnswerIndex === i}
            onChange={() => setForm({ ...form, correctAnswerIndex: i })}
            title="Mark as correct"
          />
          <input
            style={styles.answerInput}
            type="text"
            value={ans.text}
            onChange={(e) => setAnswer(i, e.target.value)}
            placeholder={`Answer ${i + 1}`}
            required
            maxLength={300}
            dir="auto"
          />
          {form.correctAnswerIndex === i && (
            <span style={styles.correctBadge}>Correct</span>
          )}
        </div>
      ))}

      <div style={styles.actions}>
        <button type="submit" style={styles.btnPrimary} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" style={styles.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontWeight: 600, marginTop: '0.5rem' },
  textarea: { padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' },
  answerRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  answerInput: { flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' },
  correctBadge: { background: '#fce4ec', color: '#880e4f', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' },
  actions: { display: 'flex', gap: '0.5rem', marginTop: '1rem' },
  btnPrimary: { padding: '0.5rem 1.2rem', background: '#c2185b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnSecondary: { padding: '0.5rem 1.2rem', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' },
};
