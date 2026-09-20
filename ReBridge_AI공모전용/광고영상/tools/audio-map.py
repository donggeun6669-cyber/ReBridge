#!/usr/bin/env python3
"""소리 지도 — 50초 믹스를 그림으로 만들어 눈으로 확인한다.
(만드는 사람이 직접 들을 수 없을 때, 어디서 무슨 소리가 나는지 보이게 하는 용도)

실행: python3 tools/audio-map.py   →  out/audio/소리지도.png
위: 배경음악 파형 · 가운데: 효과음 파형과 큐 이름 · 아래: 주파수 그림(스펙트로그램)
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((ROOT / 'audio-cues.json').read_text(encoding='utf-8'))
SR, DUR = 48000, float(CUES['duration'])
W, PAD = 1900, 60
OUT = ROOT / 'out' / 'audio' / '소리지도.png'
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'


def pcm(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def wave_rows(x, w, h):
    n = len(x)
    step = max(1, n // w)
    peaks = np.array([np.abs(x[i * step:(i + 1) * step]).max() if (i + 1) * step <= n else 0 for i in range(w)])
    return (peaks / max(peaks.max(), 1e-9) * (h / 2)).astype(int)


def draw_wave(d, x, top, h, color, label, font):
    d.rectangle([PAD, top, PAD + W, top + h], fill='#FFFFFF', outline='#DDE1E6')
    mid = top + h // 2
    for i, p in enumerate(wave_rows(x, W, h)):
        d.line([(PAD + i, mid - p), (PAD + i, mid + p)], fill=color)
    d.text((PAD + 8, top + 6), label, fill='#1E2A3A', font=font)


def main():
    mix, bgm, sfx = pcm(ROOT / 'out/audio/mix-50s.wav'), pcm(ROOT / 'out/audio/bgm-50s.wav'), pcm(ROOT / 'out/audio/sfx-50s.wav')
    font = ImageFont.truetype(FONT, 20)
    small = ImageFont.truetype(FONT, 15)
    H = 900
    im = Image.new('RGB', (W + PAD * 2, H), '#F7F8FA')
    d = ImageDraw.Draw(im)
    d.text((PAD, 16), '검고담임 광고 50초 — 소리 지도 (위: 전체 믹스 / 가운데: 배경음악 / 아래: 효과음)', fill='#1E2A3A', font=ImageFont.truetype(FONT, 24))

    draw_wave(d, mix, 60, 150, '#1C6FB2', '전체 믹스', font)
    draw_wave(d, bgm, 230, 130, '#5B6572', '배경음악 (Pixabay · Minimal Corporate Inspiration)', font)
    draw_wave(d, sfx, 380, 170, '#2F7F4F', '효과음 (직접 합성)', font)

    # 시간 눈금
    for s in range(0, int(DUR) + 1, 5):
        x = PAD + int(s / DUR * W)
        d.line([(x, 60), (x, 550)], fill='#E6E9ED')
        d.text((x + 3, 553), f'{s}초', fill='#8A93A0', font=small)

    # 효과음 큐 표시
    y = 580
    for i, c in enumerate(CUES['sfx']):
        x = PAD + int(c['t'] / DUR * W)
        col = '#C0472E' if c['type'] in ('expandSweep', 'morph') else '#1C6FB2'
        d.line([(x, 380), (x, 550)], fill=col)
        lab = f"{c['t']:.2f} {c['type']}"
        d.text((x + 2, y + (i % 6) * 22), lab, fill=col, font=small)

    # 장면 구간
    scenes = [(0, 6, '문제'), (6, 12, '등장'), (12, 23, '로드맵(13~16 확장)'), (23, 34, '점수·대학(23 전환)'),
              (34, 43, '준비·도움'), (43, 50, '브랜드·QR')]
    for a, b, name in scenes:
        x0, x1 = PAD + int(a / DUR * W), PAD + int(b / DUR * W)
        d.rectangle([x0, 740, x1 - 2, 790], fill='#EAF3FB', outline='#B9D4EA')
        d.text((x0 + 8, 752), f'{a}~{b}초 {name}', fill='#1C6FB2', font=small)
    d.text((PAD, 800), '빨간 선 = 가장 강조한 두 곳(13.4초 공간 확장, 23.0초 카드→폰 전환)', fill='#C0472E', font=small)
    d.text((PAD, 828), '이 그림은 들을 수 없는 환경에서 소리의 위치·크기를 확인하려고 만든 것이다. 실제 청취 확인은 사람이 해야 한다.',
           fill='#5B6572', font=small)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT)
    print('만듦', OUT)


if __name__ == '__main__':
    main()
