import { useState, useCallback } from 'react';
import {
  ArrowLeft, Plus, Building2, Check, ChevronDown, FileText, ExternalLink,
  Trash2, Lightbulb, ListChecks,
} from 'lucide-react';
import { loadPrimaryJob } from '../lib/persona.js';
import { INTERN_PREP } from '../data/careerMentor.js';
import '../styles.job.css';

const STORE = 'rebridge_job_apply';

function loadApps() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; }
  catch { return []; }
}
function saveApps(apps) {
  try { localStorage.setItem(STORE, JSON.stringify(apps)); } catch { /* 무시 */ }
}

export default function JobApplyScreen({ goBack = () => {}, goTo = () => {} }) {
  const job = loadPrimaryJob();
  const field = job?.field;
  const fieldPrep = field && INTERN_PREP.byField[field];

  const [apps, setApps] = useState(loadApps);
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState(null);

  const persist = useCallback((next) => { setApps(next); saveApps(next); }, []);

  const addApp = useCallback(() => {
    const nm = name.trim();
    if (!nm) return;
    const app = { id: `${nm}-${apps.length}`, name: nm, docs: {}, answers: {} };
    const next = [...apps, app];
    persist(next);
    setName('');
    setOpenId(app.id);
  }, [name, apps, persist]);

  const removeApp = useCallback((id) => {
    persist(apps.filter((a) => a.id !== id));
  }, [apps, persist]);

  const toggleDoc = useCallback((id, doc) => {
    persist(apps.map((a) => a.id === id ? { ...a, docs: { ...a.docs, [doc]: !a.docs[doc] } } : a));
  }, [apps, persist]);

  const setAnswer = useCallback((id, q, val) => {
    persist(apps.map((a) => a.id === id ? { ...a, answers: { ...a.answers, [q]: val } } : a));
  }, [apps, persist]);

  return (
    <div className="screen">
      <header className="topbar center">
        <button className="icon-btn" aria-label="뒤로" onClick={goBack}><ArrowLeft size={22} /></button>
        <span className="page-title">지원 준비</span>
      </header>

      <div className="srm-intro">
        <span className="srm-intro-kicker">기업별 자소서·서류</span>
        <h2 className="srm-intro-title">지원할 곳마다<br />하나씩 준비해요</h2>
      </div>

      <p className="job-reason" style={{ marginBottom: 13 }}>
        회사·가게마다 묻는 자소서와 필요한 서류가 달라요. <b>지원할 곳을 추가</b>하고 하나씩 채워봐요. 내용은 이 폰에만 저장돼요.
      </p>

      {fieldPrep && (
        <div className="jt-tip alt" style={{ marginBottom: 14 }}>
          <Lightbulb size={15} />
          <p>{fieldPrep.tip}</p>
        </div>
      )}

      {/* 지원할 곳 추가 */}
      <div className="ja-add">
        <input
          className="ja-input"
          placeholder="지원할 회사·가게 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addApp(); }}
        />
        <button className="ja-add-btn" onClick={addApp}><Plus size={18} /></button>
      </div>

      {/* 지원처 목록 */}
      {apps.length === 0 ? (
        <p className="note" style={{ marginTop: 18 }}>아직 추가한 곳이 없어요. 위에 지원할 곳 이름을 적고 + 를 눌러요.</p>
      ) : (
        <div className="ja-list">
          {apps.map((a) => {
            const isOpen = openId === a.id;
            const docDone = INTERN_PREP.requiredDocs.filter((d) => a.docs[d.name]).length;
            const ansDone = INTERN_PREP.selfIntroPrompts.filter((p) => (a.answers[p.q] || '').trim()).length;
            return (
              <div key={a.id} className={`ja-app ${isOpen ? 'open' : ''}`}>
                <button className="ja-app-head" onClick={() => setOpenId(isOpen ? null : a.id)}>
                  <span className="ja-app-ico"><Building2 size={18} /></span>
                  <span className="ja-app-text">
                    <span className="ja-app-name">{a.name}</span>
                    <span className="ja-app-sub">서류 {docDone}/{INTERN_PREP.requiredDocs.length} · 자소서 {ansDone}/{INTERN_PREP.selfIntroPrompts.length}</span>
                  </span>
                  <ChevronDown size={18} className="ji-item-chev" />
                </button>

                {isOpen && (
                  <div className="ja-app-body">
                    {/* 필요 서류 체크 */}
                    <p className="ja-section"><ListChecks size={14} /> 필요한 서류</p>
                    <div className="ja-docs">
                      {INTERN_PREP.requiredDocs.map((d) => (
                        <button key={d.name} className={`ja-doc ${a.docs[d.name] ? 'on' : ''}`} onClick={() => toggleDoc(a.id, d.name)}>
                          <span className={`ja-doc-box ${a.docs[d.name] ? 'on' : ''}`}>{a.docs[d.name] && <Check size={13} />}</span>
                          <span className="ja-doc-text">
                            <span className="ja-doc-name">{d.name}</span>
                            <span className="ja-doc-note">{d.note}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* 자소서 항목 */}
                    <p className="ja-section" style={{ marginTop: 16 }}><FileText size={14} /> 자기소개서 — 내 이야기로 채워요</p>
                    <div className="ja-prompts">
                      {INTERN_PREP.selfIntroPrompts.map((p) => (
                        <div key={p.q} className="ja-prompt">
                          <span className="ja-prompt-q">{p.q}</span>
                          <span className="ja-prompt-guide"><Lightbulb size={12} /> {p.guide}</span>
                          <textarea
                            className="ja-prompt-input"
                            placeholder="여기에 내 이야기를 적어요…"
                            value={a.answers[p.q] || ''}
                            onChange={(e) => setAnswer(a.id, p.q, e.target.value)}
                            rows={3}
                          />
                        </div>
                      ))}
                    </div>

                    <button className="ja-remove" onClick={() => removeApp(a.id)}><Trash2 size={14} /> 이 지원처 지우기</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 어디에 지원하나 */}
      {fieldPrep && fieldPrep.channels.length > 0 && (
        <>
          <p className="job-sec-label" style={{ marginTop: 24 }}>인턴·일경험·채용 찾는 곳</p>
          <div className="job-cat-links" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fieldPrep.channels.map((c) => (
              <a key={c.label} className="job-link" href={c.url} target="_blank" rel="noopener noreferrer">
                <span className="job-link-body"><span className="job-link-label">{c.label}</span></span>
                <ExternalLink size={15} />
              </a>
            ))}
          </div>
        </>
      )}

      <p className="note jd-foot">
        자소서는 정답이 없어요. 경험이 적어도 작은 경험을 솔직하게 쓰는 게 가장 강해요. 막히면 1388에 전화해요.
      </p>
    </div>
  );
}
