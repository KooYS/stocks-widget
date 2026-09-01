#!/usr/bin/python3
# Übersicht news.jsx 데이터 공급 — 종목별 구글뉴스 헤드라인
# 종목 목록은 stocks.json 을 그대로 공유한다. 지수는 대상이 아니다
# ponytail: 시스템 python3 고정 — python.org 빌드는 인증서 미설치라 SSL 실패
import json, os, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from sys import argv

HERE = os.path.dirname(os.path.realpath(__file__))
STORE = os.path.join(HERE, "stocks.json")
KINDS = os.path.join(HERE, "news-kinds.json")  # code -> 토스 companyCode 캐시
OUT = os.path.join(HERE, "news.json")          # 시세 위젯이 읽어가는 캐시
INDEX = {"KGG01P", "QGG01P"}  # stocks.jsx 의 INDEX 와 같은 규칙 (.NAI 는 접미사로 판별)
PER_STOCK = 25                # 종목당 수집량. 위젯이 화면에서 걸러 쓴다
LIMIT = 200                   # 페이로드 상한
WINDOW = "7d"                 # 검색 기간. 요청당 100건이 RSS 상한이라 이 안에서 논다

# ponytail: 제목 부분일치 블록리스트. 시세봇("...주가, 9월 1일 장중 43,500원 5.64% 하락")과
# 나열기사가 최신순 1등으로 올라온다. 부족하면 source(톱스타뉴스 등) 기준을 얹는다
NOISE = ("주가,", "주요공시", "[52주]", "주목받은 주식", "選")


def load():
    try:
        with open(STORE) as f:
            return json.load(f)
    except OSError:
        return {}  # stocks.py 가 아직 안 돌았다. 다음 갱신에 채워진다


def company_code(code):
    """토스 검색으로 companyCode 를 얻는다. ETF 는 EF 접두가 붙는다 (EFAMXSOXL, EFKSP069500)"""
    url = ("https://wts-info-api.tossinvest.com/api/v3/search-all/wts-auto-complete?query="
           + urllib.parse.quote(code))
    body = json.dumps({"query": code,
                       "sections": [{"type": "PRODUCT",
                                     "option": {"addIntegratedSearchResult": True}}]}).encode()
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0", "Referer": "https://www.tossinvest.com/",
        "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, body, timeout=10))["result"]
    for sec in d:
        if sec["type"] != "PRODUCT":
            continue
        for i in sec["data"]["items"]:
            if i["productCode"] == code:
                return i.get("companyCode") or ""
    return ""  # 지수는 검색에 안 잡힌다. 어차피 코드 패턴으로 먼저 걸러진다


def targets():
    """뉴스를 검색할 종목만 고른다. 지수는 코드 패턴, ETF 는 companyCode 로 뺀다"""
    tickers = load()
    codes = [c for c in tickers if not (c.endswith(".NAI") or c in INDEX)]
    # ponytail: 종목 타입은 안 바뀐다. 한 번 조회하고 파일에 캐시 — 10분마다 다시 물을 이유가 없다
    try:
        with open(KINDS) as f:
            cache = json.load(f)
    except OSError:
        cache = {}
    miss = [c for c in codes if c not in cache]
    for c in miss:
        try:
            cache[c] = company_code(c)
        except Exception:
            cache[c] = ""  # 조회 실패는 종목으로 취급. 뉴스를 아예 안 띄우는 것보단 낫다
        time.sleep(0.3)
    if miss:
        with open(KINDS, "w") as f:
            json.dump(cache, f, ensure_ascii=False, indent=1)
    return [(c, tickers[c]) for c in codes if not cache.get(c, "").startswith("EF")]


def fetch(name):
    q = f'"{name}" when:{WINDOW}'  # 따옴표 정확일치로 오매칭을 줄인다 (docs §5)
    url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(q)
           + "&hl=ko&gl=KR&ceid=KR:ko")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=15).read()


def rows(name, xml, cap=PER_STOCK):
    out = []
    for it in ET.fromstring(xml).findall(".//item"):
        title, link = it.findtext("title") or "", it.findtext("link") or ""
        # ponytail: link 는 셸(open)로 넘어간다. 구글 도메인만 통과시킨다
        if not link.startswith("https://news.google.com/") or any(n in title for n in NOISE):
            continue
        ts = datetime.strptime(it.findtext("pubDate"), "%a, %d %b %Y %H:%M:%S %Z")
        out.append({"name": name, "url": link, "ts": ts.replace(tzinfo=timezone.utc).timestamp(),
                    "title": title.rsplit(" - ", 1)[0]})  # 제목 끝에 붙는 언론사명 제거
    out.sort(key=lambda r: -r["ts"])
    return out[:cap]



def collect():
    news = []
    for code, name in targets():
        try:
            news += rows(name, fetch(name))
        except Exception:  # ponytail: 한 종목이 실패해도 나머지는 띄운다
            pass
        time.sleep(0.3)  # docs §4: 3 req/s 이하로 유지
    news.sort(key=lambda r: -r["ts"])
    return news[:LIMIT]


# ponytail: 네트워크 없이 필터만 검증 (trading-signal collect.py check 와 같은 규약)
FIXTURE = """<?xml version="1.0"?><rss><channel>
 <item><title>지엔씨에너지 주가, 9월 1일 장중 43,500원 5.64% 하락 - 톱스타뉴스</title>
  <link>https://news.google.com/rss/articles/AAA</link>
  <pubDate>Mon, 01 Sep 2026 05:00:00 GMT</pubDate></item>
 <item><title>지엔씨에너지, 창사 이래 최대 수주계약 - 전기신문</title>
  <link>https://news.google.com/rss/articles/BBB</link>
  <pubDate>Mon, 01 Sep 2026 06:00:00 GMT</pubDate></item>
 <item><title>지엔씨에너지, 신공장 착공 - 매일경제</title>
  <link>https://news.google.com/rss/articles/CCC</link>
  <pubDate>Mon, 01 Sep 2026 07:00:00 GMT</pubDate></item>
 <item><title>지엔씨에너지 낚시 - 어디선가</title>
  <link>https://evil.example.com/x</link>
  <pubDate>Mon, 01 Sep 2026 08:00:00 GMT</pubDate></item>
 <item><title>8월 31일 주식시장 주요공시 - 연합</title>
  <link>https://news.google.com/rss/articles/DDD</link>
  <pubDate>Mon, 01 Sep 2026 09:00:00 GMT</pubDate></item>
</channel></rss>"""


def check():
    r = rows("지엔씨에너지", FIXTURE.encode(), 2)  # 캡은 명시 — PER_STOCK 값에 안 묶이게
    assert [x["title"] for x in r] == ["지엔씨에너지, 신공장 착공",
                                       "지엔씨에너지, 창사 이래 최대 수주계약"], r
    assert all(x["url"].startswith("https://news.google.com/") for x in r), "도메인 가드 실패"
    assert [c for c in ("SOX.NAI", "COMP.NAI", "KGG01P", "QGG01P", "A005930")
            if not (c.endswith(".NAI") or c in INDEX)] == ["A005930"], "지수 제외 실패"
    print("ok — 시세봇/나열기사/외부도메인 3종 제거, 최신순, 언론사명 제거, 지수 제외")


if len(argv) > 1 and argv[1] == "check":
    check()
else:
    payload = json.dumps({"items": collect()}, ensure_ascii=False)
    with open(OUT, "w") as f:  # stocks.py 가 이걸 읽는다. 직접 실행 시 stdout 으로도 본다
        f.write(payload)
    print(payload)
