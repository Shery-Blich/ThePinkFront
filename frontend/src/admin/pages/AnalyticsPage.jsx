import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { getQuestionAnalytics, getSessionAnalytics, getFunnelAnalytics } from '../../api/analytics.js';

const CORRECT_COLOR = '#388e3c';
const WRONG_COLOR = '#c2185b';
const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

// Run order of the game's stages (matches Game/main.js SceneOrchestrator order)
const STAGES = [
  { key: 'Day1Scene', label: '1 · Kiryat Shmona' },
  { key: 'Day2Scene', label: '2 · Supermarket' },
  { key: 'Day3Scene', label: '3 · Public transport' },
  { key: 'Day4Scene', label: '4 · The ride' },
  { key: 'KotelScene', label: '5 · Kotel' },
  { key: 'KalpiScene', label: '6 · Ballot box' },
  { key: 'FinalScene', label: '7 · Final scene' },
];

const LINK_LABELS = {
  share: 'Share button clicked',
  share_completed: 'Share completed (sent / copied)',
  instagram: 'Instagram',
  official_voting_info: 'Election dictionary (heyzine)',
  itch_games: 'More games (itch.io)',
};

export default function AnalyticsPage() {
  const [qStats, setQStats] = useState([]);
  const [sessions, setSessions] = useState({ total: 0, avgScore: 0 });
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getQuestionAnalytics(), getSessionAnalytics(), getFunnelAnalytics()])
      .then(([q, s, f]) => {
        setQStats(q);
        setSessions(s);
        setFunnel(f);
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

      {funnel && <FunnelSection funnel={funnel} />}
      {funnel && <LinksSection funnel={funnel} />}

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
                    name: idx === q.correctAnswerIndex ? `${ANSWER_LABELS[idx]} ✓` : ANSWER_LABELS[idx],
                    count,
                    answerText: q.answerTexts?.[idx],
                  }))}
                >
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(_, p) => p[0]?.payload?.answerText || ''} />
                  <Bar dataKey="count" name="Players" radius={[4, 4, 0, 0]}>
                    {(q.distribution || []).map((_, idx) => (
                      <Cell key={idx} fill={idx === q.correctAnswerIndex ? CORRECT_COLOR : WRONG_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {q.answerTexts?.length > 0 && (
                <ol style={styles.answerList}>
                  {q.answerTexts.map((text, idx) => (
                    <li
                      key={idx}
                      style={idx === q.correctAnswerIndex ? styles.correctAnswer : undefined}
                    >
                      <strong>{ANSWER_LABELS[idx]}.</strong> {text}
                      {idx === q.correctAnswerIndex && ' ✓'}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          ))}
        </>
      )}
    </div>
  );
}

function FunnelSection({ funnel }) {
  if (funnel.totalSessions === 0) {
    return (
      <Section title="Where players leave the game">
        <p style={{ color: '#888' }}>No tracked sessions yet.</p>
      </Section>
    );
  }

  const failuresByStage = Object.fromEntries(funnel.failures.map((f) => [f.stage, f]));
  const sumWhere = (pred, field) =>
    funnel.stages.filter(pred).reduce((sum, row) => sum + row[field], 0);

  const notStarted = funnel.stages.filter((r) => r.stageIndex < 0);
  const rows = [
    {
      key: 'none',
      label: '0 · Before stage 1 loaded',
      reached: funnel.totalSessions,
      left: notStarted.reduce((sum, r) => sum + r.abandoned, 0),
      playing: notStarted.reduce((sum, r) => sum + r.inProgress, 0),
      failures: 0,
      failedPlayers: 0,
    },
    ...STAGES.map((stage, index) => ({
      key: stage.key,
      label: stage.label,
      reached: sumWhere((r) => r.stageIndex >= index, 'sessions'),
      left: sumWhere((r) => r.stageIndex === index, 'abandoned'),
      playing: sumWhere((r) => r.stageIndex === index, 'inProgress'),
      failures: failuresByStage[stage.key]?.failures ?? 0,
      failedPlayers: failuresByStage[stage.key]?.sessions ?? 0,
    })),
  ];
  const abandoned = rows.reduce((sum, r) => sum + r.left, 0);
  const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

  return (
    <>
      <div style={styles.statsRow}>
        <Stat label="Tracked sessions" value={funnel.totalSessions} />
        <Stat label="Finished the game" value={funnel.completedSessions} />
        <Stat label="Completion rate" value={pct(funnel.completedSessions, funnel.totalSessions)} />
        <Stat label="Left before the end" value={abandoned} />
      </div>

      <Section title="Where players leave the game">
        <p style={styles.note}>
          A session counts as &quot;left&quot; when it didn&apos;t finish and has had no activity for{' '}
          {funnel.idleCutoffMinutes} minutes. Newer unfinished sessions are listed as still playing.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="reached" name="Reached stage" fill="#f48fb1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="left" name="Left at stage" fill={WRONG_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Stage</th>
                <th style={styles.th}>Reached</th>
                <th style={styles.th}>Left here</th>
                <th style={styles.th}>% of reached who left</th>
                <th style={styles.th}>Still playing</th>
                <th style={styles.th}>Failures (players)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={styles.td}>{r.label}</td>
                  <td style={styles.td}>{r.reached}</td>
                  <td style={styles.td}>{r.left}</td>
                  <td style={styles.td}>{pct(r.left, r.reached)}</td>
                  <td style={styles.td}>{r.playing}</td>
                  <td style={styles.td}>{r.failures} ({r.failedPlayers})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function LinksSection({ funnel }) {
  const byType = Object.fromEntries(funnel.links.map((l) => [l.linkType, l]));
  const rows = Object.entries(LINK_LABELS).map(([type, label]) => ({
    label,
    players: byType[type]?.sessions ?? 0,
    clicks: byType[type]?.clicks ?? 0,
  }));
  const completed = funnel.completedSessions;

  return (
    <Section title="End-screen links">
      <p style={styles.note}>
        Players = unique sessions that clicked. Rate is out of {completed} player(s) who finished the game.
        Credits links are not tracked.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} layout="vertical" margin={{ left: 40 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="players" name="Players" fill="#c2185b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Link</th>
              <th style={styles.th}>Players</th>
              <th style={styles.th}>Total clicks</th>
              <th style={styles.th}>% of finishers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={styles.td}>{r.label}</td>
                <td style={styles.td}>{r.players}</td>
                <td style={styles.td}>{r.clicks}</td>
                <td style={styles.td}>{completed > 0 ? `${Math.round((r.players / completed) * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
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
  answerList: {
    listStyle: 'none', padding: 0, margin: '0.5rem 0 0', direction: 'rtl',
    fontSize: '0.85rem', color: '#555', lineHeight: 1.6,
  },
  correctAnswer: { color: CORRECT_COLOR, fontWeight: 600 },
  note: { color: '#777', fontSize: '0.8rem', marginTop: 0 },
  tableWrap: { overflowX: 'auto', marginTop: '0.75rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', borderBottom: '1px solid #e0e0e0', padding: '0.4rem 0.5rem', color: '#555', whiteSpace: 'nowrap' },
  td: { borderBottom: '1px solid #f0f0f0', padding: '0.4rem 0.5rem' },
};
