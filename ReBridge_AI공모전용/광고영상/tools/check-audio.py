#!/usr/bin/env python3
"""소리 점검 — 큐와 실제 소리가 맞는지, 영상이 그대로인지 확인한다.

실행: python3 tools/check-audio.py
보는 것
  1) 소리 있는 MP4의 영상 프레임이 무음본과 완전히 같은지 (해시 대조)
  2) 길이·해상도·fps·오디오 스트림
  3) audio-cues.json 의 효과음 시점이 실제 소리와 몇 프레임 차이인지 (목표 ±2프레임)
  4) 음량(LUFS)·최대 피크·클리핑
  5) 정보를 읽는 구간(26~34초)과 QR 구간(45.3초 이후)이 실제로 조용한지
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((ROOT / 'audio-cues.json').read_text(encoding='utf-8'))
SR = 48000
SILENT = ROOT / 'out' / '검고담임_광고_50초_1080p.mp4'
SOUND = ROOT / 'out' / '검고담임_광고_50초_1080p_사운드.mp4'
SFX = ROOT / 'out' / 'audio' / 'sfx-50s.wav'
BGM = ROOT / 'out' / 'audio' / 'bgm-50s.wav'
FRAME = 1 / 30
fails = []


def ok(cond, name, detail=''):
    print(('✅ ' if cond else '❌ ') + name + (f' — {detail}' if detail else ''))
    if not cond:
        fails.append(name)


def pcm(path, ac=1):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', str(ac), '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64)


def probe(path, entries):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', entries, '-of', 'json', str(path)],
                       capture_output=True)
    return json.loads(r.stdout)


def framemd5(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v', '-c', 'copy', '-f', 'framemd5', '-'],
                       capture_output=True)
    return [l for l in r.stdout.decode().splitlines() if l and not l.startswith('#')]


print('── 1. 영상이 그대로인가')
a, b = framemd5(SILENT), framemd5(SOUND)
ok(a == b and len(a) == 1500, '무음본과 영상 프레임이 완전히 동일', f'{len(a)}프레임 대조')

print('\n── 2. 파일 규격')
info = probe(SOUND, 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration')
v = [s for s in info['streams'] if s['codec_type'] == 'video'][0]
au = [s for s in info['streams'] if s['codec_type'] == 'audio']
dur = float(info['format']['duration'])
ok(len(au) == 1, '오디오 트랙이 들어 있음', au[0]['codec_name'] + f" {au[0]['sample_rate']}Hz {au[0]['channels']}ch" if au else '없음')
ok(abs(dur - 50.0) < 0.02, '길이 50초', f'{dur:.3f}초')
ok(v['width'] == 1920 and v['height'] == 1080 and v['r_frame_rate'] == '30/1' and int(v['nb_frames']) == 1500,
   '1920×1080 · 30fps · 1500프레임', f"{v['width']}×{v['height']} {v['r_frame_rate']} {v['nb_frames']}")

print('\n── 3. 효과음 시점 (목표 ±2프레임)')
# 소리 종류에 따라 재는 법이 다르다.
#   짧은 소리(탭·틱·체크)  → 소리가 확 커지는 순간
#   긴 소리(스윕·공간음)   → 천천히 커지므로 '들리기 시작하는 순간'
#   morph                  → 23.0초의 전환 강조점(빨아들인 뒤 터지는 지점)
SLOW = {'riseWhoosh', 'expandSweep', 'drawSweep', 'airSettle'}
x = np.abs(pcm(SFX))
hop = int(SR * 0.002)
envp = np.array([x[i:i + hop].max() for i in range(0, len(x) - hop, hop)])
d = np.diff(envp, prepend=envp[0])
worst = 0.0
for cue in CUES['sfx']:
    t, kind = cue['t'], cue['type']
    if kind in SLOW:                      # 들리기 시작하는 순간
        dur = cue.get('dur', 0.9)
        lo, hi = int((t - 0.05) / 0.002), int((t + dur) / 0.002)   # 앞 소리의 잔향이 섞이지 않게 창을 좁게
        seg = envp[max(0, lo):hi]
        thr = seg.max() * 0.10
        idx = int(np.argmax(seg > thr))
        found, how = (max(0, lo) + idx) * 0.002, '시작'
    elif kind == 'morph':                 # 전환 강조점(설정상 시작 +0.24초 = 23.0초)
        t = t + 0.24
        lo, hi = int((t - 0.12) / 0.002), int((t + 0.12) / 0.002)
        found, how = (max(0, lo) + int(np.argmax(d[max(0, lo):hi]))) * 0.002, '강조점'
    else:                                 # 짧은 소리
        w = 0.06
        lo, hi = int((t - w) / 0.002), int((t + w) / 0.002)
        found, how = (max(0, lo) + int(np.argmax(d[max(0, lo):hi]))) * 0.002, '시작'
    off = found - t
    worst = max(worst, abs(off))
    ok(abs(off) <= 2 * FRAME, f"{t:6.2f}s {kind:12s}({how})", f'{off * 1000:+.0f}ms ({off / FRAME:+.1f}프레임)')
print(f'   가장 큰 차이 {worst * 1000:.0f}ms ({worst / FRAME:.1f}프레임)')

print('\n── 4. 음량·피크')
err = subprocess.run(['ffmpeg', '-v', 'info', '-i', str(SOUND), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                     capture_output=True).stderr.decode()
tail = err[err.rfind('Integrated loudness'):]
vals = {}
for key in ('I:', 'LRA:', 'Peak:'):
    for line in tail.splitlines():
        if line.strip().startswith(key):
            vals[key] = float(line.split()[1])
            break
tgt = CUES['target']
ok(-18.5 <= vals.get('I:', 0) <= -15.5, '전체 음량 -18.5 ~ -15.5 LUFS', f"{vals.get('I:')} LUFS (목표 {tgt['lufsI']})")
ok(vals.get('Peak:', 0) <= -1.0, '최대 피크 -1 dBTP 이하', f"{vals.get('Peak:')} dBTP")
ok(vals.get('LRA:', 0) >= 4, '다이내믹이 살아 있음(LRA ≥ 4)', f"{vals.get('LRA:')} LU")
mix = np.abs(pcm(SOUND, ac=2))
ok(mix.max() < 0.999, '클리핑 없음', f'최대 샘플 {mix.max():.3f}')
for stem, label in ((SFX, '효과음 스템'), (BGM, '배경음악 스템')):
    p = float(np.abs(pcm(stem, ac=2)).max())
    ok(p < 0.995, f'{label} 클리핑 없음', f'최대 {20 * np.log10(p + 1e-9):.1f} dBFS')

print('\n── 5. 절제해야 할 구간')
sfx_rms = lambda a, b: float(np.sqrt(np.mean(pcm(SFX)[int(a * SR):int(b * SR)] ** 2)) + 1e-12)
bgm_rms = lambda a, b: 20 * np.log10(float(np.sqrt(np.mean(pcm(BGM)[int(a * SR):int(b * SR)] ** 2))) + 1e-12)
late_cues = [c for c in CUES['sfx'] if c['t'] > 45.3]
ok(not late_cues, 'QR 화면(45.3초 이후)에 새 효과음 큐 없음', f'{len(late_cues)}개' if late_cues else '0개')
qr = 20 * np.log10(sfx_rms(46.5, 50.0) + 1e-12)   # 45.0초 소리의 잔향이 지나간 뒤
ok(qr < -60, 'QR 화면 끝부분(46.5초 이후) 효과음 없음', f'효과음 트랙 {qr:.0f} dB')
info_db, other_db = bgm_rms(26, 34), bgm_rms(36, 43)
ok(info_db < other_db, '정보를 읽는 구간(26~34초) 음악이 더 낮음', f'{info_db:.1f} dB vs 36~43초 {other_db:.1f} dB')
lift = bgm_rms(14.4, 17.4) - bgm_rms(9, 12)
ok(lift > 1.0, '13~16초 공간 확장에서 음악이 열림', f'+{lift:.1f} dB')
end_db, late_db = bgm_rms(49.9, 50.0), bgm_rms(49.0, 50.0)
ok(end_db < -55 and late_db < -30, '음악이 50초에 맞춰 사라짐', f'마지막 0.1초 {end_db:.0f} dB · 마지막 1초 {late_db:.0f} dB')

print('\n결과:', '모두 통과' if not fails else f'{len(fails)}개 실패 — ' + ', '.join(fails[:5]))
sys.exit(1 if fails else 0)
