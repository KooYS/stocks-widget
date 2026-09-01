// Übersicht widget — 종목별 구글뉴스 헤드라인 (데이터는 옆의 news.py)
// 시세 카드와 갱신 주기가 달라서(10초 vs 10분) 위젯을 따로 뒀다.
// ponytail: Übersicht가 위젯별 refreshFrequency를 주므로 그게 곧 캐시다. TTL 코드 없음
import { run } from "uebersicht";

const HELPER = "./news.py";
export const refreshFrequency = 600000; // 10분. 종목당 1요청이라 자주 돌 게 아니다
export const command = HELPER;

// ponytail: Übersicht는 위젯끼리 import를 못 한다. stocks.jsx 의 드래그를 그대로 복사
const POS_KEY = "news-widget-pos";
const HOME = { x: 400, y: 60 };

const loadPos = () => {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY)) || HOME;
  } catch (e) {
    return HOME;
  }
};

const startDrag = (e) => {
  if (e.target.closest(".list")) return; // 목록 안에서는 스크롤·클릭이 우선
  e.preventDefault();
  const el = e.currentTarget;
  const dx = e.clientX - el.offsetLeft;
  const dy = e.clientY - el.offsetTop;
  const move = (ev) => {
    el.style.left = ev.clientX - dx + "px";
    el.style.top = ev.clientY - dy + "px";
  };
  const drop = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", drop);
    localStorage.setItem(POS_KEY, JSON.stringify({ x: el.offsetLeft, y: el.offsetTop }));
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", drop);
};

const openArticle = (url) => () => run(`open "${url}"`);

// ponytail: 위젯 render는 컴포넌트가 아니라서 훅을 못 쓴다.
// Übersicht가 주는 updateState/dispatch 가 상태 보관 방식이다
export const initialState = { output: "", error: null, pick: null };

export const updateState = (event, prev) => {
  if (event.type === "PICK") return { ...prev, pick: event.name };
  if (event.type === "UB/COMMAND_RAN")
    return { ...prev, output: event.output, error: event.error };
  return prev;
};

export const className = `
  top: 0; left: 0;

  .card { position: absolute; width: 340px;
  padding: 18px 20px 14px;
  cursor: grab; user-select: none;
  border-radius: 24px;
  /* ponytail: backdrop-filter 쓰지 말 것. 갱신마다 재샘플링되며 깜빡인다 (stocks.jsx 참고) */
  background: rgba(40, 44, 52, 0.6);
  box-shadow: 0 8px 32px rgba(0,0,0,0.28);
  color: #fff;
  font-family: -apple-system, "SF Pro Text", sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased; }
  .card:active { cursor: grabbing; }

  .head { display: flex; justify-content: space-between; align-items: baseline;
          font-size: 11px; opacity: 0.6; margin-bottom: 10px; letter-spacing: 0.3px; }

  .list { max-height: 300px; overflow-y: auto; overscroll-behavior: contain; cursor: default; }
  .list::-webkit-scrollbar { width: 5px; }
  .list::-webkit-scrollbar-track { background: transparent; }
  .list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 3px; }

  .item { padding: 6px 0; }
  .meta { font-size: 10px; opacity: 0.5; letter-spacing: 0.3px; }
  .title { opacity: 0.85; line-height: 1.35; margin-top: 2px; cursor: pointer; }
  .title:hover { opacity: 1; text-decoration: underline; }
  .rule { height: 1px; background: rgba(255,255,255,0.12); margin: 2px 0; }
  .empty { opacity: 0.5; padding: 6px 0; }

  button { background: none; border: 0; padding: 0; margin: 0;
           color: inherit; font: inherit; cursor: pointer; opacity: 0.85; }
  button:hover { opacity: 1; text-decoration: underline; }
`;

export const parse = (output) => JSON.parse(output).items;

const ago = (ts) => {
  const m = (Date.now() / 1000 - ts) / 60;
  return m < 60 ? `${Math.max(1, Math.round(m))}m` : `${Math.round(m / 60)}h`;
};

// 기본은 종목당 최신 1건, 종목을 고르면 그 종목만, 전체보기면 다.
const shown = (items, pick) => {
  if (pick === "*") return items;
  if (pick) return items.filter((n) => n.name === pick);
  const seen = new Set(); // items 가 이미 최신순이라 첫 등장만 남기면 종목당 최신 1건이다
  const out = [];
  for (const n of items) {
    if (!seen.has(n.name)) {
      seen.add(n.name);
      out.push(n);
    }
  }
  return out;
};

export const render = ({ output, error, pick }, dispatch) => {
  const pos = loadPos();
  const go = (name) => () => dispatch({ type: "PICK", name });
  const card = (body) => (
    <div className="card" style={{ left: pos.x, top: pos.y }} onMouseDown={startDrag}>
      <div className="head">{body}</div>
    </div>
  );
  if (error) return card("에러: " + String(error));
  let items;
  try {
    items = parse(output);
  } catch (e) {
    return card("뉴스 없음");
  }
  const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const rows = shown(items, pick);
  return (
    <div className="card" style={{ left: pos.x, top: pos.y }} onMouseDown={startDrag}>
      <div className="head">
        {pick ? (
          <button onClick={go(null)} title="돌아가기">‹ {pick === "*" ? "전체" : pick}</button>
        ) : (
          <span>뉴스</span>
        )}
        <span>
          {!pick && (
            <button onClick={go("*")} title="전체 보기">전체 {items.length}건</button>
          )}{" "}
          {now}
        </span>
      </div>
      <div className="list">
        {rows.length === 0 && <div className="empty">뉴스 없음</div>}
        {rows.map((n, i) => (
          <div key={n.url}>
            {i > 0 && <div className="rule" />}
            <div className="item">
              <div className="meta">
                <button onClick={go(n.name)} title={`${n.name} 뉴스만 보기`}>{n.name}</button>
                {" · " + ago(n.ts)}
              </div>
              <div className="title" onClick={openArticle(n.url)} title="기사 열기">{n.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
