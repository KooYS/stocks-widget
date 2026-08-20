# stocks-widget

macOS [Übersicht](https://tracesof.net/uebersicht/) 데스크탑 위젯. 토스증권 시세 + 네이버 환율.

- 미장 / 국장 / 환율 3그룹 (응답 통화로 자동 분류)
- 카드 드래그로 위치 이동 (localStorage에 저장)
- `＋ 종목` 으로 검색해서 추가, 줄에 마우스 올려 `×` 로 삭제
- 10초마다 갱신, 프리마켓·데이마켓 반영

## 파일

| 파일 | 역할 |
|---|---|
| `stocks.jsx` | 위젯 렌더링 · 드래그 · 추가/삭제 버튼 |
| `stocks.py` | 시세·환율 조회, 종목 추가/삭제 (osascript 다이얼로그) |
| `~/.config/stocks.json` | 종목 목록. **레포 밖의 런타임 데이터** — 없으면 `stocks.py`의 `DEFAULT` 사용 |

## 설치

```sh
git clone <repo> ~/stocks-widget
ln -s ~/stocks-widget/stocks.py  ~/.config/stocks.py
ln -s ~/stocks-widget/stocks.jsx "$HOME/Library/Application Support/Übersicht/widgets/stocks.jsx"
```

Übersicht 실행 후 자동 로드. `stocks.jsx` 수정이 바로 안 붙으면 Übersicht 메뉴 → Refresh All Widgets.

## 종목 코드

토스 productCode를 쓴다. 페이지 URL에서 그대로 복사:

- 국내주식 `https://www.tossinvest.com/stocks/A005930/order` → `A005930`
- 해외주식 `.../stocks/US19890516001/order`
- 지수 `.../indices/SOX.NAI`

`＋ 종목`은 토스 자동완성으로 검색한다. 지수는 검색에 안 잡히므로 코드를 직접 입력하면 시세 확인 후 표시 이름만 묻는다.

## API

둘 다 비공식이라 언제든 깨질 수 있다. 실패하면 위젯은 "시세 없음"만 띄운다.

- 시세: `wts-info-api.tossinvest.com/api/v3/stock-prices?productCodes=...` (`Referer: tossinvest.com` 필요)
- 검색: `wts-info-api.tossinvest.com/api/v3/search-all/wts-auto-complete` (POST)
- 환율: `m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=FX_USDKRW` (`pageSize` 10 이상만 허용)

## 확인

```sh
./stocks.py | python3 -m json.tool   # tickers / prices / fx 세 키가 나오면 정상
```

시스템 `/usr/bin/python3` 고정. python.org 빌드는 인증서가 없어 SSL이 실패한다.
