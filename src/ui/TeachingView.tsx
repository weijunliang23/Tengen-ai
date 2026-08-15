import { useMemo, useState } from 'react';
import { getLesson, LESSONS, LessonReplay } from '../core/teaching';
import { Board } from './Board';

/** 教学模式：课件选择 + 逐步演示 + 图文说明 */
export function TeachingView() {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const [tick, setTick] = useState(0);
  const lesson = useMemo(() => getLesson(lessonId), [lessonId]);
  const [replay, setReplay] = useState(() => new LessonReplay(lesson));
  const [step, setStepState] = useState(0);

  const lessonIndex = LESSONS.findIndex((l) => l.id === lessonId);
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < LESSONS.length - 1 ? LESSONS[lessonIndex + 1] : null;

  const goTo = (s: number) => {
    replay.goTo(s);
    setStepState(replay.step);
    setTick((t) => t + 1);
  };

  const selectLesson = (id: string) => {
    const l = getLesson(id);
    setLessonId(id);
    setReplay(new LessonReplay(l, 0));
    setStepState(0);
    setTick((t) => t + 1);
  };

  return (
    <>
      <section className="board-area">
        <div className="board-frame">
          <Board view={replay} tick={tick} interactive={false} marks={replay.stepMarks()} />
        </div>
        <div className="board-status">
          <span className="status-dot" />
          {lesson.title} · 第 {step + 1} / {replay.totalSteps} 步
        </div>
      </section>

      <aside className="side-panel">
        {/* 桌面端：完整选课列表；移动端隐藏，改用顶部下拉（见逐步演示卡） */}
        <section className="card teach-select-card">
          <h2 className="card-title">
            <span className="card-icon">课</span>
            规则演示 · 选课
          </h2>
          <div className="lesson-list">
            {LESSONS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`lesson-btn${l.id === lessonId ? ' active' : ''}`}
                onClick={() => selectLesson(l.id)}
              >
                <span className="lesson-name">{l.title}</span>
                <span className="lesson-summary">{l.summary}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card teach-steps-card">
          <div className="card-head">
            <h2 className="card-title">
              <span className="card-icon">步</span>
              逐步演示
            </h2>
            <span className="step-badge">
              第 {step + 1} / {replay.totalSteps} 步
            </span>
          </div>
          {/* 移动端：选课下拉 */}
          <select
            className="lesson-select only-mobile"
            value={lessonId}
            onChange={(e) => selectLesson(e.target.value)}
            aria-label="选择演示课件"
          >
            {LESSONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} — {l.summary}
              </option>
            ))}
          </select>
          <div className="btn-row four">
            <button type="button" className="btn" disabled={step === 0} onClick={() => goTo(0)} title="回到开头">
              ⏮
            </button>
            <button type="button" className="btn" disabled={step === 0} onClick={() => goTo(step - 1)} title="上一步">
              ◀
            </button>
            <button
              type="button"
              className="btn"
              disabled={step >= replay.totalSteps - 1}
              onClick={() => goTo(step + 1)}
              title="下一步"
            >
              ▶
            </button>
            <button
              type="button"
              className="btn"
              disabled={step >= replay.totalSteps - 1}
              onClick={() => goTo(replay.totalSteps - 1)}
              title="到最后"
            >
              ⏭
            </button>
          </div>
          <input
            type="range"
            className="slider"
            min={0}
            max={replay.totalSteps - 1}
            value={step}
            onChange={(e) => goTo(Number(e.target.value))}
          />
          <div className="lesson-desc">
            <span className="lesson-step-num">第 {step + 1} 步</span>
            <div className="lesson-step-title">{replay.stepTitle()}</div>
            <p className="lesson-step-desc">{replay.stepDesc()}</p>
          </div>
          {step >= replay.totalSteps - 1 && (
            <div className="lesson-next">
              {nextLesson ? (
                <>
                  <span className="lesson-next-text">
                    本课完成 ✓ 下一课：{nextLesson.title}
                  </span>
                  <button type="button" className="btn" onClick={() => selectLesson(nextLesson.id)}>
                    开始下一课 →
                  </button>
                </>
              ) : (
                <span className="lesson-next-text">全部课程完成 🎉 返回「对局」页实战吧</span>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">
            <span className="card-icon">示</span>
            图例
          </h2>
          <ul className="legend">
            <li>
              <span className="legend-dot red" /> 打吃 / 禁止 / 死子
            </li>
            <li>
              <span className="legend-dot green" /> 气点（点击棋子查看）
            </li>
            <li>
              <span className="legend-dot orange" /> 讲解重点（高亮）
            </li>
          </ul>
          <p className="card-note">教学模式下棋盘只读；返回「对局」页即可落子。</p>
        </section>
      </aside>
    </>
  );
}
