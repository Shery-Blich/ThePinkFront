import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { getQuestionAnalytics, getSessionAnalytics } from '../../api/analytics.js';

const ANSWER_COLORS = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2'];
const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

export default function AnalyticsPage() {
  const [qStats, setQStats] = useState([]);
  const [sessions, setSessions] = useState({ total: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getQuestionAnalytics(), getSessionAnalytics()])
      .then(([q, s]) => {
        setQStats(q);
        setSessions(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading analytics...</p>;

  const correctRateData = qStats.map((q, i) => ({
    name: `Q${i + 1}`,
    rate: Math.round((q.correctRate || 0) * 100),
    label: q.questionText?.slice(0, 40),
  }));

  return (
    <div>
      <h2>Analytics</h2>

      <div style={styles.statsRow}>
        <Stat label="Total game sessions" value={sessions.total} />
        <Stat label="Average score" value={`${Math.round((sessions.avgScore || 0) * 100)}%`} />
        <Stat label="Questions" value={qStats.length} />
      </div>

      {qStats.length === 0 ? (
        <p style={{ color: '#888' }}>No game data yet. Analytics will appear once the game is live.</p>
      ) : (
        <>
          <Section title="Correct Answer Rate per Question">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={correctRateData}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} labelFormatter={(_, p) => p[0]?.payload?.label || ''} />
                <Bar dataKey="rate" fill="#c2185b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {qStats.map((q, i) => (
            <Section key={q.questionId} title={`Q${i + 1}: ${q.questionText?.slice(0, 60) || ''}…`}>
              <p style={{ color: '#555', fontSize: '0.85rem' }}>
                {q.totalAnswers} answer(s) — correct rate:{' '}
                <strong>{Math.round((q.correctRate || 0) * 100)}%</strong> — avg time:{' '}
                <strong>{q.avgTimeSpentMs ? (q.avgTimeSpentMs / 1000).toFixed(1) + 's' : 'N/A'}</strong>
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={(q.distribution || []).map((count, idx) => ({
                    name: ANSWER_LABELS[idx],
                    count,
                  }))}
                >
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(q.distribution || []).map((_, idx) => (
                      <Cell key={idx} fill={ANSWER_COLORS[idx]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

const styles = {
  statsRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  statCard: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem 1.5rem', minWidth: '140px' },
  statValue: { fontSize: '2rem', fontWeight: 700, color: '#c2185b' },
  statLabel: { color: '#666', fontSize: '0.85rem', marginTop: '0.25rem' },
  section: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' },
  sectionTitle: { marginTop: 0, fontSize: '0.95rem', color: '#333' },
};
