#!/usr/bin/python3
# Übersicht news.jsx 데이터 공급 — 종목별 구글뉴스 헤드라인
# 종목 목록은 stocks.json 을 그대로 공유한다. 지수는 대상이 아니다
# ponytail: 시스템 python3 고정 — python.org 빌드는 인증서 미설치라 SSL 실패
import json, os, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from sys import argv

STORE = os.path.join(os.path.dirname(os.path.realpath(__file__)), "stocks.json")
INDEX = {"KGG01P", "QGG01P"}  # stocks.jsx 의 INDEX 와 같은 규칙 (.NAI 는 접미사로 판별)
PER_STOCK = 1                 # 종목당 1건. 2로 올리면 대형주가 목록을 다 먹는다
LIMIT = 8

# ponytail: 제목 부분일치 블록리스트. 시세봇("...주가, 9월 1일 장중 43,500원 5.64% 하락")과
# 나열기사가 최신순 1등으로 올라온다. 부족하면 source(톱스타뉴스 등) 기준을 얹는다
NOISE = ("주가,", "주요공시", "[52주]", "주목받은 주식", "選")


def load():
    try:
        with open(STORE) as f:
            return json.load(f)
    except OSError:
        return {}  # stocks.py 가 아직 안 돌았다. 다음 갱신에 채워진다


def fetch(name):
    q = f'"{name}" when:2d'  # 따옴표 정확일치로 오매칭을 줄인다 (docs §5)
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
    for code, name in load().items():
        if code.endswith(".NAI") or code in INDEX:
            continue  # 지수는 종목 뉴스 대신 시황이 잡히고 오매칭이 심하다
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
    print(json.dumps({"items": collect()}, ensure_ascii=False))
