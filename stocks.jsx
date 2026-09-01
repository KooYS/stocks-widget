// Übersicht widget — 토스증권 시세 + 환율 + 종목 뉴스 (데이/프리마켓 반영)
// 저장소에 두고 Übersicht widgets 디렉토리에 심링크로 건다
// 좌측 시세 / 우측 뉴스 2열. 좌측 종목을 누르면 우측이 그 종목 뉴스로 바뀐다
// 데이터는 옆의 stocks.py 하나가 다 준다 (뉴스는 news.py 가 채운 캐시를 얹어서)
import { run } from "uebersicht";

// ponytail: Übersicht는 widgets 디렉토리를 cwd로 명령을 돌린다. 저장소 경로 하드코딩 대신
// widgets/stocks.py 심링크를 상대경로로 부른다 (shebang이 /usr/bin/python3 고정)
const HELPER = "./stocks.py";
// 지수는 통화기호를 안 붙인다. 코스피/코스닥이 currency:KRW로 와서 코드로 구분해야 한다
const INDEX = new Set(["KGG01P", "QGG01P"]);
const UNIT = { KRW: "₩", USD: "$" };

export const refreshFrequency = 10000;
export const command = HELPER;

// ponytail: 위젯 render는 컴포넌트가 아니라서 훅을 못 쓴다.
// Übersicht가 주는 updateState/dispatch 가 상태 보관 방식이다
export const initialState = { output: "", error: null, pick: null };

export const updateState = (event, prev) => {
  if (event.type === "PICK") return { ...prev, pick: event.name };
  if (event.type === "UB/COMMAND_RAN")
    return { ...prev, output: event.output, error: event.error };
  return prev;
};

// ponytail: Übersicht엔 드래그가 없다. 좌표만 localStorage에 남긴다
const POS_KEY = "stocks-widget-pos";
const HOME = { x: 40, y: 60 };

const loadPos = () => {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY)) || HOME;
  } catch (e) {
    return HOME;
  }
};

const startDrag = (e) => {
  if (e.target.closest("button, .list")) return; // 버튼·뉴스목록은 드래그 아님
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

// ponytail: 다음 refresh(10초)까지 기다리지 않게 지운 줄은 바로 숨긴다
const remove = (code) => (e) => {
  e.stopPropagation();
  e.currentTarget.closest(".row").style.display = "none";
  run(`${HELPER} del ${code}`);
};
const add = () => run(`${HELPER} add`);
const openArticle = (url) => () => run(`open "${url}"`);

export const className = `
  top: 0; left: 0;

  .card { position: absolute;
  padding: 18px 20px 14px;
  cursor: grab; user-select: none;
  border-radius: 24px;
  /* ponytail: backdrop-filter 쓰지 말 것. 갱신마다 backdrop이 재샘플링되며
     한순간 평균색(=불투명)으로 떠서 깜빡인다. 레이어 승격·분리 둘 다 안 먹혔다 */
  background: rgba(40, 44, 52, 0.6);
  box-shadow: 0 8px 32px rgba(0,0,0,0.28);
  color: #fff;
  font-family: -apple-system, "SF Pro Text", sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased; }
  .card:active { cursor: grabbing; }

  .head { display: flex; justify-content: space-between; align-items: baseline;
          font-size: 11px; opacity: 0.6; margin-bottom: 12px; letter-spacing: 0.3px; }
  .cols { display: flex; align-items: stretch; }
  .left { width: 300px; min-height: 220px; }
  /* ponytail: 카드 높이는 좌측 시세가 정한다. .right 는 in-flow 자식이 없어서(.pane 이
     absolute) 뉴스가 137건이든 높이를 못 민다. stretch 로 좌측 높이를 그대로 받고
     .list 가 그 안에서 스크롤한다. flex:1 만으로는 우측 내용이 카드를 늘려버린다 */
  .right { position: relative; width: 338px; margin-left: 18px;
           border-left: 1px solid rgba(255,255,255,0.12); }
  .pane { position: absolute; top: 0; right: 0; bottom: 0; left: 18px;
          display: flex; flex-direction: column; }

  .row  { display: flex; justify-content: space-between; align-items: baseline;
          padding: 5px 0; border-radius: 6px; }
  .row.pick { cursor: pointer; }
  .row.pick:hover { background: rgba(255,255,255,0.07); }
  .row.on { background: rgba(255,255,255,0.13); }
  .name { opacity: 0.88; }
  .val  { font-variant-numeric: tabular-nums; font-weight: 500; }
  .pct  { display: inline-block; width: 62px; text-align: right; }
  .up   { color: #ff7b72; }
  .down { color: #79b8ff; }
  .rule { height: 1px; background: rgba(255,255,255,0.12); margin: 8px 0; }
  .grp  { font-size: 10px; opacity: 0.45; letter-spacing: 0.5px; margin: 2px 0 1px; }

  .list { flex: 1; min-height: 0; overflow-y: auto;
          overscroll-behavior: contain; cursor: default; }
  .list::-webkit-scrollbar { width: 5px; }
  .list::-webkit-scrollbar-track { background: transparent; }
  .list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 3px; }
  .item { padding: 6px 0; }
  .meta { font-size: 10px; opacity: 0.5; letter-spacing: 0.3px; }
  .title { opacity: 0.85; line-height: 1.35; margin-top: 2px; cursor: pointer; }
  .title:hover { opacity: 1; text-decoration: underline; }
  .thin { height: 1px; background: rgba(255,255,255,0.08); margin: 2px 0; }
  .empty { opacity: 0.45; padding: 6px 0; font-size: 12px; }

  button { background: none; border: 0; padding: 0 0 0 6px; margin: 0;
           color: inherit; font: inherit; cursor: pointer; }
  .del  { opacity: 0; transition: opacity 0.12s; }
  .row:hover .del { opacity: 0.5; }
  .del:hover { opacity: 1 !important; }
  .add  { opacity: 0.6; font-size: 13px; line-height: 1; }
  .add:hover { opacity: 1; }
  .link { opacity: 0.75; padding: 0; }
  .link:hover { opacity: 1; text-decoration: underline; }
`;

// ponytail: 응답 순서가 요청 순서와 다르다. tickers 순서로 다시 세운다
export const parse = (output) => {
  const { tickers, prices, fx, news } = JSON.parse(output);
  const got = {};
  for (const d of prices) got[d.productCode] = d;
  const rows = tickers.flatMap(([code, name]) => {
    const d = got[code];
    if (!d) return []; // 없는 코드는 토스가 조용히 빼고 준다
    const pct = ((d.close - d.base) / d.base) * 100;
    const isIndex = code.endsWith(".NAI") || INDEX.has(code);
    const digits = !isIndex && d.currency === "KRW" ? 0 : 2;
    const unit = isIndex ? "" : UNIT[d.currency];
    return [{ code, name, pct, krw: d.currency === "KRW", price: unit + fmt(d.close, digits) }];
  });
  const fxRows = fx.map((f) => ({ name: f.name, pct: f.pct, price: "₩" + fmt(f.close, 2) }));
  // 미장/국장은 통화로 갈린다 (코스피·코스닥은 KRW, .NAI 지수는 USD)
  const groups = [
    { label: "미장", rows: rows.filter((r) => !r.krw), del: true },
    { label: "국장", rows: rows.filter((r) => r.krw), del: true },
    { label: "환율", rows: fxRows },
  ].filter((g) => g.rows.length);
  return { groups, news: news || [] };
};

const fmt = (n, digits) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// 7일치까지 들어오므로 "162h" 로는 언제 글인지 안 읽힌다. 하루 넘으면 날짜를 같이 준다
const ago = (ts) => {
  const d = new Date(ts * 1000);
  const min = (Date.now() - d) / 60000;
  if (min < 60) return `${Math.max(1, Math.round(min))}분 전`;
  if (min < 1440) return `${Math.round(min / 60)}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()} · ${Math.round(min / 1440)}일 전`;
};

// 기본은 종목당 최신 1건, 종목을 고르면 그 종목만, 전체보기면 다.
const shown = (news, pick) => {
  if (pick === "*") return news;
  if (pick) return news.filter((n) => n.name === pick);
  const seen = new Set(); // news 가 이미 최신순이라 첫 등장만 남기면 종목당 최신 1건이다
  const out = [];
  for (const n of news) {
    if (!seen.has(n.name)) {
      seen.add(n.name);
      out.push(n);
    }
  }
  return out;
};

const Row = ({ r, onDelete, onPick, on }) => (
  <div className={"row" + (onPick ? " pick" : "") + (on ? " on" : "")}
       onClick={onPick || undefined}
       title={onPick ? `${r.name} 뉴스 보기` : undefined}>
    <span className="name">
      {r.name}
      {onDelete && <button className="del" onClick={onDelete} title="삭제">×</button>}
    </span>
    <span className="val">
      {r.price}{" "}
      <span className={"pct " + (r.pct >= 0 ? "up" : "down")}>
        {(r.pct >= 0 ? "▲" : "▼") + Math.abs(r.pct).toFixed(2) + "%"}
      </span>
    </span>
  </div>
);

export const render = ({ output, error, pick }, dispatch) => {
  const pos = loadPos();
  const go = (name) => () => dispatch({ type: "PICK", name });
  const card = (body) => (  // 실패해도 카드 위치는 유지되게
    <div className="card" style={{ left: pos.x, top: pos.y }} onMouseDown={startDrag}>
      <div className="head">{body}</div>
    </div>
  );
  if (error) return card("에러: " + String(error));
  let data;
  try {
    data = parse(output);
  } catch (e) {
    return card("시세 없음");
  }
  const { groups, news } = data;
  const hasNews = new Set(news.map((n) => n.name)); // 뉴스가 있는 종목만 클릭 가능
  const rows = shown(news, pick);
  const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="card" style={{ left: pos.x, top: pos.y }} onMouseDown={startDrag}>
      <div className="head">
        <button className="add" onClick={add} title="종목 추가">＋ 종목</button>
        <span>{now}</span>
      </div>
      <div className="cols">
        <div className="left">
          {groups.map((g, i) => (
            <div key={g.label}>
              {i > 0 && <div className="rule" />}
              <div className="grp">{g.label}</div>
              {g.rows.map((r) => (
                <Row key={r.code || r.name} r={r}
                     onDelete={g.del && remove(r.code)}
                     onPick={hasNews.has(r.name) ? go(pick === r.name ? null : r.name) : null}
                     on={pick === r.name} />
              ))}
            </div>
          ))}
        </div>
        <div className="right">
          <div className="pane">
            <div className="head">
              {pick ? (
                <button className="link" onClick={go(null)} title="돌아가기">
                  ‹ {pick === "*" ? "전체" : pick}
                </button>
              ) : (
                <span>뉴스</span>
              )}
              {!pick && news.length > 0 && (
                <button className="link" onClick={go("*")} title="전체 보기">
                  전체 {news.length}건
                </button>
              )}
            </div>
            <div className="list">
              {rows.length === 0 && <div className="empty">뉴스를 받는 중…</div>}
              {rows.map((n, i) => (
                <div key={n.url}>
                  {i > 0 && <div className="thin" />}
                  <div className="item">
                    <div className="meta">{n.name} · {ago(n.ts)}</div>
                    <div className="title" onClick={openArticle(n.url)} title="기사 열기">
                      {n.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
