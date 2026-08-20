// Übersicht widget — 토스증권 시세 + 환율 (데이/프리마켓 반영)
// ~/Library/Application Support/Übersicht/widgets/stocks.jsx
// 종목 목록 / 추가 / 삭제는 ~/.config/stocks.py 가 담당 (목록은 ~/.config/stocks.json)
import { run } from "uebersicht";

const HELPER = "/usr/bin/python3 ~/.config/stocks.py";
// 지수는 통화기호를 안 붙인다. 코스피/코스닥이 currency:KRW로 와서 코드로 구분해야 한다
const INDEX = new Set(["KGG01P", "QGG01P"]);
const UNIT = { KRW: "₩", USD: "$" };

export const refreshFrequency = 10000;
export const command = HELPER;

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
  if (e.target.closest("button")) return; // 버튼 클릭은 드래그 아님
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
  e.currentTarget.closest(".row").style.display = "none";
  run(`${HELPER} del ${code}`);
};
const add = () => run(`${HELPER} add`);

export const className = `
  top: 0; left: 0;

  .card { position: absolute; width: 320px;
  padding: 18px 20px 14px;
  cursor: grab; user-select: none;
  border-radius: 24px;
  background: rgba(40, 44, 52, 0.55);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.28);
  color: #fff;
  font-family: -apple-system, "SF Pro Text", sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased; }
  .card:active { cursor: grabbing; }

  .head { display: flex; justify-content: space-between; align-items: baseline;
          font-size: 11px; opacity: 0.6; margin-bottom: 12px; letter-spacing: 0.3px; }
  .row  { display: flex; justify-content: space-between; align-items: baseline;
          padding: 5px 0; }
  .name { opacity: 0.88; }
  .val  { font-variant-numeric: tabular-nums; font-weight: 500; }
  .pct  { display: inline-block; width: 62px; text-align: right; }
  .up   { color: #ff7b72; }
  .down { color: #79b8ff; }
  .rule { height: 1px; background: rgba(255,255,255,0.12); margin: 8px 0; }
  .grp  { font-size: 10px; opacity: 0.45; letter-spacing: 0.5px; margin: 2px 0 1px; }

  button { background: none; border: 0; padding: 0 0 0 6px; margin: 0;
           color: inherit; font: inherit; cursor: pointer; }
  .del  { opacity: 0; transition: opacity 0.12s; }
  .row:hover .del { opacity: 0.5; }
  .del:hover { opacity: 1 !important; }
  .add  { opacity: 0.6; font-size: 13px; line-height: 1; }
  .add:hover { opacity: 1; }
`;

// ponytail: 응답 순서가 요청 순서와 다르다. tickers 순서로 다시 세운다
export const parse = (output) => {
  const { tickers, prices, fx } = JSON.parse(output);
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
  return [
    { label: "미장", rows: rows.filter((r) => !r.krw), del: true },
    { label: "국장", rows: rows.filter((r) => r.krw), del: true },
    { label: "환율", rows: fxRows },
  ].filter((g) => g.rows.length);
};

const fmt = (n, digits) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const Row = ({ r, onDelete }) => (
  <div className="row">
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

export const render = ({ output, error }) => {
  const pos = loadPos();
  const card = (body) => (  // 실패해도 카드 위치는 유지되게
    <div className="card" style={{ left: pos.x, top: pos.y }} onMouseDown={startDrag}>
      <div className="head">{body}</div>
    </div>
  );
  if (error) return card("에러: " + String(error));
  let groups;
  try {
    groups = parse(output);
  } catch (e) {
    return card("시세 없음");
  }
  const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="card" style={{ left: pos.x, top: pos.y }} onMouseDown={startDrag}>
      <div className="head">
        <button className="add" onClick={add} title="종목 추가">＋ 종목</button>
        <span>{now}</span>
      </div>
      {groups.map((g, i) => (
        <div key={g.label}>
          {i > 0 && <div className="rule" />}
          <div className="grp">{g.label}</div>
          {g.rows.map((r) => (
            <Row key={r.code || r.name} r={r} onDelete={g.del && remove(r.code)} />
          ))}
        </div>
      ))}
    </div>
  );
};
