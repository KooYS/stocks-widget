#!/usr/bin/python3
# Übersicht stocks.jsx 데이터 공급 + 종목 추가/삭제
# 인자 없으면 위젯용 JSON 출력, `add`는 검색 다이얼로그, `del <코드>`는 삭제
# ponytail: 시스템 python3 고정 — python.org 빌드는 인증서 미설치라 SSL 실패
import json, os, subprocess, time, urllib.parse, urllib.request
from sys import argv

# 종목 목록은 스크립트 옆에 둔다 (심링크로 불려도 실제 저장소 위치로 풀린다). 없으면 아래 기본값
HERE = os.path.dirname(os.path.realpath(__file__))
STORE = os.path.join(HERE, "stocks.json")
NEWS = os.path.join(HERE, "news.json")  # news.py 가 채우는 캐시
NEWS_TTL = 600  # 10분

# 토스 productCode. 국내주식 A+종목코드, 지수/해외주식은 페이지 URL에서 복사:
# https://www.tossinvest.com/stocks/<코드>/order , /indices/<코드>
DEFAULT = {
    "SOX.NAI": "필라델피아반도체",
    "COMP.NAI": "나스닥",
    "KGG01P": "코스피",
    "QGG01P": "코스닥",
    "US20100311002": "SOXL",
    "US19890516001": "마이크론",
    "NAS0250224006": "샌디스크",
    "A005930": "삼성전자",
    "A000660": "SK하이닉스",
    "A017670": "SK텔레콤",
}
FX = {"FX_USDKRW": "달러", "FX_JPYKRW": "엔(100)"}


def load():
    try:
        with open(STORE) as f:
            return json.load(f)
    except OSError:
        return dict(DEFAULT)


def save(tickers):
    with open(STORE, "w") as f:
        json.dump(tickers, f, ensure_ascii=False, indent=1)


def api(url, body=None, ref="https://www.tossinvest.com/"):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": ref})
    if body is not None:
        req.add_header("Content-Type", "application/json")
        body = json.dumps(body).encode()
    return json.load(urllib.request.urlopen(req, body, timeout=10))


def osa(*script):
    r = subprocess.run(["osascript"] + [x for s in script for x in ("-e", s)],
                       capture_output=True, text=True)
    out = r.stdout.strip()
    return "" if out == "false" else out  # 취소하면 false


def news():
    """뉴스는 캐시에서 읽는다. 오래됐으면 백그라운드로만 갱신한다.
    ponytail: 이 명령은 10초마다 돈다. news.py 는 종목당 1요청이라 10초쯤 걸리므로
    절대 여기서 기다리면 안 된다. 띄워만 놓고 결과는 다음 틱에 받는다"""
    try:
        age = time.time() - os.path.getmtime(NEWS)
    except OSError:
        age = NEWS_TTL + 1
    if age > NEWS_TTL:
        open(NEWS, "a").close()
        os.utime(NEWS, None)  # mtime 을 지금으로 → 다음 틱이 중복 실행하지 않는다
        subprocess.Popen([os.path.join(HERE, "news.py")],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with open(NEWS) as f:
            return json.load(f)["items"]
    except (OSError, ValueError, KeyError):
        return []  # 아직 안 채워졌다. 다음 틱에 들어온다


def prices(codes):
    url = "https://wts-info-api.tossinvest.com/api/v3/stock-prices?productCodes=" + ",".join(codes)
    return api(url)["result"]


def fx():
    out = []
    for code, name in FX.items():  # 네이버 환율. 엔은 100엔 기준
        url = ("https://m.stock.naver.com/front-api/marketIndex/prices"
               f"?category=exchange&reutersCode={code}&page=1&pageSize=10")
        d = api(url, ref="https://m.stock.naver.com/")["result"][0]
        out.append({"name": name,
                    "close": float(d["closePrice"].replace(",", "")),
                    "pct": float(d["fluctuationsRatio"])})
    return out


def cmd_add():
    q = osa('display dialog "종목명 또는 토스 productCode" default answer "" with title "종목 추가"',
            "text returned of result")
    if not q:
        return
    url = ("https://wts-info-api.tossinvest.com/api/v3/search-all/wts-auto-complete?query="
           + urllib.parse.quote(q))
    body = {"query": q, "sections": [{"type": "PRODUCT", "option": {"addIntegratedSearchResult": True}}]}
    hits = [i for s in api(url, body)["result"] if s["type"] == "PRODUCT"
            for i in s["data"]["items"]][:8]
    if hits:
        labels = [f'{i["productName"]} ({i["productCode"]})' for i in hits]
        lst = ", ".join('"%s"' % l.replace('"', "'") for l in labels)
        pick = osa(f'choose from list {{{lst}}} with title "종목 추가"')
        if not pick:
            return
        hit = hits[labels.index(pick)]
        code, name = hit["productCode"], hit["productName"]
    else:  # ponytail: 지수는 검색에 안 잡힌다. 코드 직접 입력으로 폴백
        if not prices([q]):
            osa(f'display alert "찾을 수 없는 종목: {q}"')
            return
        code = q
        name = osa(f'display dialog "표시할 이름" default answer "{q}" with title "종목 추가"',
                   "text returned of result") or q
    tickers = load()
    tickers[code] = name
    save(tickers)


if len(argv) > 1:
    if argv[1] == "add":
        cmd_add()
    elif argv[1] == "del":
        tickers = load()
        tickers.pop(argv[2], None)
        save(tickers)
    raise SystemExit

tickers = load()
print(json.dumps({"tickers": list(tickers.items()), "prices": prices(tickers),
                  "fx": fx(), "news": news()}, ensure_ascii=False))
