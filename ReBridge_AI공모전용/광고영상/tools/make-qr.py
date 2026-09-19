# QR 다시 만들기 — 주소가 바뀌면 src/config.js 의 demoUrl 과 같이 바꾼다.
# 실행: python3 tools/make-qr.py https://gumgomentor.vercel.app
# 파이썬 qrcode 모듈을 쓴다(이 맥에 설치돼 있음). 만든 뒤 node tools/verify.mjs 로 실제 판독을 확인한다.
import sys, os
import qrcode

url = sys.argv[1] if len(sys.argv) > 1 else 'https://gumgomentor.vercel.app'
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
qr.add_data(url)
qr.make(fit=True)
m = qr.get_matrix()
n = len(m)
d = ''.join(f'M{x} {y}h1v1h-1z' for y, row in enumerate(m) for x, v in enumerate(row) if v)
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'qr-gumgomentor.svg')
with open(out, 'w') as f:
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges"><path fill="#1E2A3A" d="{d}"/></svg>\n')
print('만듦', os.path.abspath(out), url)
