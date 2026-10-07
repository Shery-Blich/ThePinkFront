import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  getQuestionAnalytics, getSessionAnalytics, getFunnelAnalytics, getOverviewAnalytics,
} from '../../api/analytics.js';

const CORRECT_COLOR = '#388e3c';
const PINK = '#c2185b';
const PINK_LIGHT = '#f48fb1';
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
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getQuestionAnalytics(), getSessionAnalytics(), getFunnelAnalytics(), getOverviewAnalytics()])
      .then(([q, s, f, o]) => {
        setQStats(q);
        setSessions(s);
        setFunnel(f);
        setOverview(o);
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

      {overview && <TimelineSection overview={overview} />}
      {funnel && <FunnelSection funnel={funnel} />}
      {overview && <RetriesSection overview={overview} />}
      {overview && <SourcesSection sources={overview.sources} />}
      {funnel && <LinksSection funnel={funnel} />}
      {overview && <ScoresSection scores={overview.scores} />}

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
        <p style={styles.empty}>No tracked sessions yet. Play the game once and they&apos;ll show up here.</p>
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
      label: 'Opened the game',
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
  const total = funnel.totalSessions;
  // The stage that loses the largest share of the players who reach it
  const worst = rows.reduce((w, r) => (r.reached && r.left / r.reached > (w ? w.left / w.reached : 0) ? r : w), null);

  return (
    <>
      <div style={styles.statsRow}>
        <Stat label="Tracked sessions" value={total} />
        <Stat label="Completion rate" value={pct(funnel.completedSessions, total)} sub={`${funnel.completedSessions} finished`} />
        <Stat label="Left before the end" value={abandoned} sub={pct(abandoned, total) + ' of sessions'} />
        <Stat label="Biggest drop-off" value={worst ? worst.label.replace(/^\d+ · /, '') : '—'} sub={worst ? `${pct(worst.left, worst.reached)} leave here` : 'No drop-offs yet'} small />
      </div>

      <Section
        title="Where players leave the game"
        note={`"Left" = closed the game before the end, or idle for ${funnel.idleCutoffMinutes}+ min. Other unfinished sessions count as still playing.`}
      >
        <div style={styles.funnel}>
          {rows.map((r) => (
            <div
              key={r.key}
              style={styles.funnelRow}
              title={`${r.label}\nReached: ${r.reached}\nLeft here: ${r.left}\nStill playing: ${r.playing}\nLosses: ${r.failures} (${r.failedPlayers} players)`}
            >
              <div style={styles.funnelLabel}>{r.label}</div>
              <div style={styles.track}>
                <div style={{ ...styles.bar, width: `${(r.reached / total) * 100}%`, opacity: r === worst ? 1 : 0.85 }} />
              </div>
              <div style={styles.funnelValue}>
                <strong>{r.reached}</strong>
                <span style={styles.muted}> · {pct(r.reached, total)}</span>
              </div>
              <div style={styles.chips}>
                {r.left > 0 && <span style={{ ...styles.chip, ...styles.chipDrop }}>↓ {r.left} left ({pct(r.left, r.reached)})</span>}
                {r.playing > 0 && <span style={styles.chip}>▶ {r.playing} playing</span>}
                {r.failures > 0 && <span style={styles.chip}>✕ {r.failures} losses · {r.failedPlayers} players</span>}
              </div>
            </div>
          ))}
        </div>

        <details style={styles.details}>
          <summary style={styles.summary}>Show as table</summary>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Stage', 'Reached', 'Left here', '% of reached who left', 'Still playing', 'Losses (players)'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td style={styles.td}>{r.label}</td>
                    <td style={styles.tdNum}>{r.reached}</td>
                    <td style={styles.tdNum}>{r.left}</td>
                    <td style={styles.tdNum}>{pct(r.left, r.reached)}</td>
                    <td style={styles.tdNum}>{r.playing}</td>
                    <td style={styles.tdNum}>{r.failures} ({r.failedPlayers})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Section>
    </>
  );
}

function LinksSection({ funnel }) {
  const byType = Object.fromEntries(funnel.links.map((l) => [l.linkType, l]));
  const completed = funnel.completedSessions;
  const rows = Object.entries(LINK_LABELS)
    .map(([type, label]) => ({
      type,
      label,
      players: byType[type]?.sessions ?? 0,
      clicks: byType[type]?.clicks ?? 0,
    }))
    .sort((a, b) => b.players - a.players);
  const max = Math.max(1, ...rows.map((r) => r.players));

  return (
    <Section
      title="End-screen links"
      note={`Players = unique sessions that clicked. % is out of ${completed} player(s) who finished. Credits links aren't tracked.`}
    >
      <div style={styles.funnel}>
        {rows.map((r) => (
          <div key={r.type} style={styles.linkRow} title={`${r.label}\nPlayers: ${r.players}\nTotal clicks: ${r.clicks}`}>
            <div style={styles.funnelLabel}>{r.label}</div>
            <div style={styles.track}>
              <div style={{ ...styles.bar, width: `${(r.players / max) * 100}%` }} />
            </div>
            <div style={styles.funnelValue}>
              <strong>{r.players}</strong>
              <span style={styles.muted}> · {pct(r.players, completed)} · {r.clicks} clicks</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TimelineSection({ overview }) {
  const data = overview.timeline.map((d) => ({
    ...d,
    // "2026-10-08" -> "8/10" (day/month, as read in Israel)
    label: `${Number(d.day.slice(8))}/${Number(d.day.slice(5, 7))}`,
  }));

  return (
    <Section title="Players per day" note={`By the day the game was opened (${overview.timezone} time). Finished = reached the end that same run.`}>
      {data.length === 0 ? (
        <p style={styles.empty}>No sessions yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 16 }}>
            <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={12} />
            <YAxis allowDecimals={false} />
            <Tooltip labelFormatter={(_, p) => p[0]?.payload?.day || ''} />
            <Legend />
            <Bar dataKey="started" name="Started" fill={PINK_LIGHT} radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="Finished" fill={PINK} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Section>
  );
}

function ScoresSection({ scores }) {
  const finished = scores.reduce((sum, s) => sum + s.sessions, 0);
  if (finished === 0) return null;

  const maxQuestions = Math.max(...scores.map((s) => s.maxQuestions));
  const byCorrect = Object.fromEntries(scores.map((s) => [s.correct, s.sessions]));
  const data = Array.from({ length: maxQuestions + 1 }, (_, correct) => ({
    name: `${correct}/${maxQuestions}`,
    players: byCorrect[correct] ?? 0,
  }));

  return (
    <Section title="Score distribution" note={`Correct answers per player, out of ${finished} player(s) who finished.`}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16 }}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(v) => [`${v} (${pct(v, finished)})`, 'Players']} />
          <Bar dataKey="players" name="Players" fill={PINK} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}

const LOSS_BUCKETS = [
  { losses: 1, label: 'Lost once' },
  { losses: 2, label: 'Lost twice' },
  { losses: 3, label: 'Lost 3+ times' },
];

function RetriesSection({ overview }) {
  if (overview.retries.length === 0) return null;

  const stageOrder = STAGES.map((s) => s.key);
  const labelOf = (key) => STAGES.find((s) => s.key === key)?.label ?? key;
  const stages = [...new Set(overview.retries.map((r) => r.stage))]
    .sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));
  const cell = (stage, losses) => overview.retries.find((r) => r.stage === stage && r.losses === losses);

  return (
    <Section
      title="Losing a stage vs. quitting"
      note="Players who lost a stage, by how many times they lost it, and how many of them then quit there. A high quit rate after repeated losses means the stage is too hard."
    >
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Stage</th>
              {LOSS_BUCKETS.map((b) => <th key={b.losses} style={styles.th}>{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage}>
                <td style={styles.td}>{labelOf(stage)}</td>
                {LOSS_BUCKETS.map((b) => {
                  const c = cell(stage, b.losses);
                  if (!c) return <td key={b.losses} style={{ ...styles.tdNum, ...styles.muted }}>—</td>;
                  // Players still on the stage haven't decided yet, so leave them out of the rate
                  const decided = c.players - c.stillPlaying;
                  const quitRate = decided > 0 ? c.quit / decided : 0;
                  return (
                    <td
                      key={b.losses}
                      style={styles.tdNum}
                      title={`${c.players} player(s)\nGot past it: ${c.passed}\nQuit here: ${c.quit}\nStill playing: ${c.stillPlaying}`}
                    >
                      <strong style={quitRate >= 0.5 ? styles.danger : undefined}>{pct(c.quit, decided)} quit</strong>
                      <span style={styles.muted}> · {c.players} players</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const SOURCE_GROUPS = [
  { key: 'channel', title: 'Channel' },
  { key: 'deviceType', title: 'Device' },
  { key: 'os', title: 'Operating system' },
  { key: 'browser', title: 'Browser' },
  { key: 'campaign', title: 'UTM campaign' },
];

function SourcesSection({ sources }) {
  return (
    <Section
      title="Where players come from"
      note={`Out of ${sources.total} session(s) since source tracking started. Channel = utm_source if the link had one, else the app or site the player came from. Add ?utm_source=…&utm_campaign=… to links you post to tell them apart.`}
    >
      {sources.total === 0 ? (
        <p style={styles.empty}>No sessions with source info yet.</p>
      ) : (
        <div style={styles.sourceGrid}>
          {SOURCE_GROUPS.filter((g) => sources[g.key]?.length > 0).map((g) => {
            const max = Math.max(1, ...sources[g.key].map((r) => r.sessions));
            return (
              <div key={g.key}>
                <h4 style={styles.subTitle}>{g.title}</h4>
                <div style={styles.funnel}>
                  {sources[g.key].slice(0, 8).map((r) => (
                    <div key={r.key} style={{ ...styles.linkRow, ...styles.sourceRow }} title={`${r.key}\nSessions: ${r.sessions}\nFinished: ${r.completed}`}>
                      <div style={styles.funnelLabel}>{r.key}</div>
                      <div style={styles.track}>
                        <div style={{ ...styles.bar, width: `${(r.sessions / max) * 100}%` }} />
                      </div>
                      <div style={styles.funnelValue}>
                        <strong>{r.sessions}</strong>
                        <span style={styles.muted}> · {pct(r.completed, r.sessions)} finish</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

const pct = (n, d) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

function Stat({ label, value, sub, small }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, ...(small && styles.statValueSmall) }}>{value}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {note && <p style={styles.note}>{note}</p>}
      {children}
    </div>
  );
}

const INK = '#1f1f24';
const MUTED = '#6b6b76';
const BORDER = '#ececf0';

const styles = {
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' },
  statCard: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '1rem 1.25rem', boxShadow: '0 1px 2px rgba(16,16,24,0.04)' },
  statLabel: { color: MUTED, fontSize: '0.8rem', fontWeight: 500 },
  statValue: { fontSize: '2rem', fontWeight: 700, color: INK, lineHeight: 1.2, marginTop: '0.35rem' },
  statValueSmall: { fontSize: '1.25rem', paddingTop: '0.4rem' },
  statSub: { color: MUTED, fontSize: '0.8rem', marginTop: '0.2rem' },
  section: { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: '0 1px 2px rgba(16,16,24,0.04)' },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, color: INK },
  note: { color: MUTED, fontSize: '0.8rem', margin: '0.25rem 0 0' },
  empty: { color: MUTED, fontSize: '0.9rem', margin: '0.75rem 0 0' },
  funnel: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' },
  funnelRow: {
    display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr auto', gridTemplateAreas: '"label bar value" ". chips chips"',
    alignItems: 'center', columnGap: '0.75rem', rowGap: '0.25rem', padding: '0.4rem 0', borderBottom: `1px solid ${BORDER}`,
  },
  linkRow: { display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr auto', gridTemplateAreas: '"label bar value"', alignItems: 'center', columnGap: '0.75rem', padding: '0.3rem 0' },
  funnelLabel: { gridArea: 'label', fontSize: '0.85rem', color: INK, fontWeight: 500 },
  track: { gridArea: 'bar', height: '14px', background: '#fbeef3', borderRadius: '4px', overflow: 'hidden' },
  bar: { height: '100%', background: '#c2185b', borderRadius: '4px', transition: 'width 0.4s ease' },
  funnelValue: { gridArea: 'value', fontSize: '0.85rem', color: INK, whiteSpace: 'nowrap', minWidth: '90px', textAlign: 'right' },
  muted: { color: MUTED, fontWeight: 400 },
  chips: { gridArea: 'chips', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' },
  chip: { fontSize: '0.72rem', color: MUTED, background: '#f4f4f6', borderRadius: '999px', padding: '0.1rem 0.55rem' },
  chipDrop: { color: '#8a1040', background: '#fce4ec', fontWeight: 600 },
  details: { marginTop: '1rem' },
  sourceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1.25rem 2rem', marginTop: '0.5rem' },
  // Narrow columns: let the label share space with the bar instead of squeezing it out
  sourceRow: { gridTemplateColumns: 'minmax(70px, 1fr) minmax(40px, 1fr) 7.5rem' },
  subTitle: { margin: '0.75rem 0 0', fontSize: '0.85rem', fontWeight: 600, color: MUTED },
  danger: { color: '#8a1040' },
  summary: { cursor: 'pointer', color: MUTED, fontSize: '0.8rem' },
  answerList: {
    listStyle: 'none', padding: 0, margin: '0.5rem 0 0', direction: 'rtl',
    fontSize: '0.85rem', color: '#555', lineHeight: 1.6,
  },
  correctAnswer: { color: CORRECT_COLOR, fontWeight: 600 },
  tableWrap: { overflowX: 'auto', marginTop: '0.75rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', borderBottom: `1px solid ${BORDER}`, padding: '0.5rem', color: MUTED, fontWeight: 500, whiteSpace: 'nowrap' },
  td: { borderBottom: `1px solid ${BORDER}`, padding: '0.5rem', color: INK },
  tdNum: { borderBottom: `1px solid ${BORDER}`, padding: '0.5rem', color: INK, fontVariantNumeric: 'tabular-nums' },
};
