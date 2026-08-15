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
        <section className="card">
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

        <section className="card">
          <h2 className="card-title">
            <span className="card-icon">步</span>
            逐步演示
          </h2>
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
            <div className="lesson-step-title">{replay.stepTitle()}</div>
            <p className="lesson-step-desc">{replay.stepDesc()}</p>
          </div>
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
