#!/usr/bin/env python3
"""광고 소리 만들기 — audio-cues.json 하나만 보고 전부 다시 만든다.

실행:  python3 tools/make-audio.py            (믹스 + 미리보기용 m4a + 소리 있는 MP4)
       python3 tools/make-audio.py --no-mux   (영상 합치기 없이 소리만)

만드는 것
  out/audio/bgm-50s.wav     배경음악만 (50초)
  out/audio/sfx-50s.wav     효과음만 (50초)
  out/audio/mix-50s.wav     최종 믹스 (음량 맞춤 뒤)
  assets/audio/ad-mix-50s.m4a   미리보기(HTML)와 MP4가 같이 쓰는 최종 오디오
  out/검고담임_광고_50초_1080p_사운드.mp4   기존 무음 MP4 + 위 오디오 (영상은 그대로 복사)

필요한 것: 이 맥의 ffmpeg, python3 + numpy. 새로 설치하지 않는다.
효과음은 전부 여기서 계산해서 만든다(내려받은 효과음 없음).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CUES = json.loads((ROOT / 'audio-cues.json').read_text(encoding='utf-8'))
SR = int(CUES['sampleRate'])
DUR = float(CUES['duration'])
N = int(round(DUR * SR))
SILENT_MP4 = ROOT / 'out' / '검고담임_광고_50초_1080p.mp4'
OUT_MP4 = ROOT / 'out' / '검고담임_광고_50초_1080p_사운드.mp4'
PREVIEW_M4A = ROOT / 'assets' / 'audio' / 'ad-mix-50s.m4a'
rng = np.random.default_rng(20260920)  # 같은 결과가 나오도록 씨앗 고정


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def db2lin(db):
    return 10.0 ** (db / 20.0)


def write_wav(path, x):
    """f32 스테레오 배열을 24bit WAV로 저장 (ffmpeg 경유)"""
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = np.asarray(x, dtype=np.float32).T.reshape(-1).tobytes()
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2',
         '-i', '-', '-c:a', 'pcm_s24le', str(path)], input=raw)


# ────────────────────────── 소리 만드는 재료 ──────────────────────────
def env(n, attack, release, curve=2.0):
    """클릭 잡음이 안 생기게 시작·끝을 완만하게 만드는 봉투"""
    e = np.ones(n)
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a) ** 0.6
    e[-r:] = np.linspace(1, 0, r) ** curve
    return e


def noise_band(dur, f_lo, f_hi):
    """정해진 주파수 대역만 남긴 잡음"""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(n, 1 / SR)
    g = np.exp(-0.5 * ((np.log2(np.maximum(fr, 1) / np.sqrt(f_lo * f_hi)) / (np.log2(f_hi / f_lo) / 2.5)) ** 2))
    return np.fft.irfft(X * g, n)


def noise_sweep(dur, f0, f1, bw=1.6, shape=0.6):
    """중심 주파수가 f0 → f1 로 움직이는 잡음 (짧은 조각마다 대역을 바꿔 이어 붙인다)"""
    n = int(dur * SR)
    x = rng.standard_normal(n + 2048)
    frame, hop = 2048, 512
    out = np.zeros(n + frame)
    win = np.hanning(frame)
    fr = np.fft.rfftfreq(frame, 1 / SR)
    pos = 0
    while pos + frame <= len(x):
        u = min(1.0, (pos / max(1, n)) ** shape)
        fc = f0 * (f1 / f0) ** u
        g = np.exp(-0.5 * (np.log2(np.maximum(fr, 1) / fc) / bw) ** 2)
        seg = np.fft.irfft(np.fft.rfft(x[pos:pos + frame] * win) * g, frame)
        out[pos:pos + frame] += seg
        pos += hop
    return out[:n]


def tone(dur, freq, decay, harm=0.0, harm_ratio=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / decay)
    if harm:
        y += harm * np.sin(2 * np.pi * freq * harm_ratio * t) * np.exp(-t / (decay * 0.6))
    return y


def reverb_ir(dur=0.6, damp=6.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * damp)
    ir[:int(0.005 * SR)] = 0
    X = np.fft.rfft(ir)
    fr = np.fft.rfftfreq(n, 1 / SR)
    X *= np.exp(-0.5 * (np.log2(np.maximum(fr, 1) / 1200) / 1.8) ** 2)  # 어두운 잔향
    ir = np.fft.irfft(X, n)
    # 에너지 기준으로 맞춘다 — 피크로 맞추면 합성곱 뒤 소리가 몇 배로 커진다
    return ir / (np.sqrt(np.sum(ir ** 2)) + 1e-9)


def mix_in(dst, src, off):
    """길이가 어긋나도 안전하게 더한다"""
    n = min(len(src), len(dst) - off)
    if n > 0:
        dst[off:off + n] += src[:n]
    return dst


def stereo(mono, width=0.0):
    """살짝만 좌우를 벌린다(과한 좌우 이동은 피한다)"""
    if width <= 0:
        return np.stack([mono, mono])
    d = int(width * 0.0012 * SR)
    left = np.concatenate([mono[d:], np.zeros(d)]) if d else mono
    return np.stack([mono, left * 0.98 + mono * 0.02])


# ────────────────────────── 효과음 종류 ──────────────────────────
def make_sfx(kind, cue):
    """큐의 db 값이 '실제 최대 크기(dBFS)'가 되도록 항상 peak=1 로 맞춰 돌려준다"""
    y = _make_sfx(kind, cue)
    peak = float(np.max(np.abs(y)))
    return y / peak if peak > 1e-9 else y


def _make_sfx(kind, cue):
    if kind == 'paper':                       # 종이 카드 등장
        y = noise_band(0.09, 1500, 5200) * env(int(0.09 * SR), 0.004, 0.07, 2.5)
        return stereo(y, 0.3)
    if kind == 'tap':                         # 화면 누름
        d = 0.085
        y = tone(d, cue.get('freq', 720), 0.022, harm=0.35, harm_ratio=2.0)
        y += noise_band(d, 2000, 6000) * np.exp(-np.arange(int(d * SR)) / SR / 0.006) * 0.12
        return stereo(y * env(int(d * SR), 0.003, 0.05, 2.0), 0.2)
    if kind == 'inputTick':                   # 점수 입력 (더 건조하고 작게)
        d = 0.05
        y = tone(d, cue.get('freq', 1050), 0.012, harm=0.2, harm_ratio=1.5)
        y += noise_band(d, 2500, 7000) * np.exp(-np.arange(int(d * SR)) / SR / 0.004) * 0.1
        return stereo(y * env(int(d * SR), 0.002, 0.03, 2.0), 0.15)
    if kind == 'settle' or kind == 'standSettle':   # 카드가 자리에 앉음
        d = 0.22
        f = cue.get('freq', 520 if kind == 'settle' else 520)
        y = tone(d, f, 0.07, harm=0.3, harm_ratio=2.0) * env(int(d * SR), 0.008, 0.16, 2.0)
        return stereo(y, 0.25)
    if kind == 'check':                       # 서류 체크 (낮은음 → 높은음)
        y = np.zeros(int(0.28 * SR))
        mix_in(y, tone(0.1, 780, 0.05) * env(int(0.1 * SR), 0.005, 0.07) * 0.8, 0)
        mix_in(y, tone(0.16, 1170, 0.06) * env(int(0.16 * SR), 0.005, 0.12) * 0.7, int(0.075 * SR))
        return stereo(y, 0.2)
    if kind == 'riseWhoosh':                  # 폰이 올라옴
        d = cue.get('dur', 1.5)
        y = noise_sweep(d, 180, 1400, bw=1.5, shape=0.75) * env(int(d * SR), 0.25, 0.55, 1.6)
        return stereo(y, 0.6)
    if kind == 'expandSweep':                 # 공간이 펼쳐짐 (핵심)
        d = cue.get('dur', 2.6)
        n = int(d * SR)
        y = noise_sweep(d, 240, 3200, bw=1.7, shape=0.7) * env(n, 0.22, 0.9, 1.4)
        y += noise_sweep(d, 90, 400, bw=1.2, shape=0.9) * env(n, 0.4, 1.0, 1.5) * 0.45   # 아래쪽 공기감
        return stereo(y, 1.0)
    if kind == 'morph':                       # 카드가 폰이 됨 (핵심 전환)
        pre, post = 0.24, 0.85
        y = np.zeros(int((pre + post) * SR) + 8)
        inh = noise_sweep(pre, 2600, 700, bw=1.4, shape=1.0) * env(int(pre * SR), 0.05, 0.1, 1.2)
        mix_in(y, inh * 0.55, 0)                                     # 빨아들이는 소리
        o = int(pre * SR)
        # 전환점은 또렷하게 — 여기서 소리가 가장 크도록 빠르게 열고 길게 흘린다
        body = noise_sweep(post, 900, 2600, bw=1.5, shape=0.5) * env(int(post * SR), 0.004, 0.6, 1.6)
        body *= np.concatenate([np.linspace(1.35, 1.0, int(0.12 * SR)), np.ones(len(body) - int(0.12 * SR))])
        mix_in(y, body * 0.9, o)
        mix_in(y, noise_band(0.05, 1800, 6000) * env(int(0.05 * SR), 0.002, 0.04, 2.0) * 0.5, o)
        low = tone(0.45, 96, 0.12) * env(int(0.45 * SR), 0.006, 0.35, 2.0)
        mix_in(y, low * 0.28, o)                                     # 아주 작은 저음 한 번
        return stereo(y, 0.5)
    if kind == 'drawSweep':                   # 선이 캠퍼스까지 그려짐
        d = cue.get('dur', 1.1)
        y = noise_sweep(d, 700, 2400, bw=1.3, shape=0.6) * env(int(d * SR), 0.2, 0.5, 1.5)
        return stereo(y, 0.7)
    if kind == 'airSettle':                   # 로고가 자리 잡음 (음정 없는 마무리)
        d = 0.9
        y = noise_band(d, 500, 2600) * env(int(d * SR), 0.12, 0.7, 1.8)
        return stereo(y * 0.9, 0.5)
    raise SystemExit(f'모르는 효과음 종류: {kind}')


# ────────────────────────── 1. 배경음악 ──────────────────────────
def build_bgm():
    b = CUES['bgm']
    src = ROOT / b['file']
    if not src.exists():
        raise SystemExit(f'배경음악 파일이 없다: {src}')
    raw = run(['ffmpeg', '-v', 'error', '-ss', str(b['startInTrack']), '-t', str(DUR + 1),
               '-i', str(src), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, 2).T
    if x.shape[1] < N:
        raise SystemExit('배경음악이 50초보다 짧다')
    x = x[:, :N]

    t = np.arange(N) / SR
    auto = np.array(b['automation'], dtype=float)
    gain = db2lin(np.interp(t, auto[:, 0], auto[:, 1]) + b.get('gainDb', 0.0))
    fi, fo = b['fadeIn'], b['fadeOut']
    gain *= np.clip((t - fi[0]) / max(1e-6, fi[1] - fi[0]), 0, 1) ** 1.5
    gain *= np.clip((fo[1] - t) / max(1e-6, fo[1] - fo[0]), 0, 1) ** 1.2
    return x * gain


# ────────────────────────── 2. 효과음 ──────────────────────────
def build_sfx():
    buf = np.zeros((2, N + SR))
    ir = reverb_ir()
    wet = np.zeros_like(buf)
    for cue in CUES['sfx']:
        y = make_sfx(cue['type'], cue) * db2lin(cue['db'])
        i = int(round(cue['t'] * SR))
        n = y.shape[1]
        if i + n > buf.shape[1]:
            y = y[:, :buf.shape[1] - i]
            n = y.shape[1]
        buf[:, i:i + n] += y
        if cue['type'] in ('expandSweep', 'morph', 'airSettle', 'drawSweep', 'riseWhoosh'):
            w = np.stack([np.convolve(y[c], ir)[:n + len(ir)] for c in range(2)])
            m = min(w.shape[1], buf.shape[1] - i)
            wet[:, i:i + m] += w[:, :m] * 0.28   # 잔향은 옅게(에너지 기준)
    return (buf + wet)[:, :N]


# ────────────────────────── 3. 믹스 ──────────────────────────
def soft_limit(x, ceiling=0.89, atk=0.004, rel=0.12):
    """천장을 넘는 순간에만 잠깐 볼륨을 낮춘다(전체를 눌러 다이내믹을 없애지 않는다)"""
    peak = np.max(np.abs(x), axis=0)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    if need.min() > 0.999:
        return x
    # 필요한 감쇠를 앞뒤로 완만하게 번지게 한다
    g = need.copy()
    a = int(atk * SR), int(rel * SR)
    k = np.concatenate([np.linspace(0, 1, a[0]), np.ones(1), np.linspace(1, 0, a[1])])
    k /= k.sum()
    g = 1.0 - np.convolve(1.0 - g, k, mode='same')
    return x * np.minimum(g, need)


def loudness(path):
    err = subprocess.run(['ffmpeg', '-v', 'info', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True).stderr.decode()
    tail = err[err.rfind('Integrated loudness'):]
    out = {}
    for key, name in [('I:', 'I'), ('LRA:', 'LRA'), ('Peak:', 'TP')]:
        for line in tail.splitlines():
            if line.strip().startswith(key):
                out[name] = float(line.split()[1])
                break
    return out


def main():
    (ROOT / 'out' / 'audio').mkdir(parents=True, exist_ok=True)
    print('1) 배경음악 자르고 볼륨 곡선 적용')
    bgm = build_bgm()
    write_wav(ROOT / 'out/audio/bgm-50s.wav', bgm)
    print('2) 효과음 합성', len(CUES['sfx']), '개')
    sfx = build_sfx()
    write_wav(ROOT / 'out/audio/sfx-50s.wav', sfx)

    print('3) 믹스')
    mix = soft_limit(bgm + sfx)
    raw_path = ROOT / 'out/audio/mix-50s-raw.wav'
    write_wav(raw_path, mix)

    tgt = CUES['target']
    print('4) 음량 맞추기 (목표', tgt['lufsI'], 'LUFS,', tgt['truePeakDb'], 'dBTP)')
    # 압축기를 걸지 않고 '전체 볼륨'만 움직인다 → 다이내믹(LRA)이 그대로 남는다.
    # 최대 피크가 목표를 넘으면 그만큼만 더 내린다.
    final_wav = ROOT / 'out/audio/mix-50s.wav'
    gain_db = 0.0
    for i in range(3):
        cur = mix * db2lin(gain_db)
        write_wav(final_wav, cur)
        m = loudness(final_wav)
        need_l = tgt['lufsI'] - m['I']
        need_p = tgt['truePeakDb'] - m['TP']
        print(f"   {i + 1}차: {m['I']:.1f} LUFS / {m['TP']:.1f} dBTP / LRA {m['LRA']:.1f}")
        if abs(need_l) < 0.3 and need_p >= -0.05:
            break
        gain_db += min(need_l, need_p)     # 음량과 피크 중 더 빡빡한 쪽에 맞춘다
    print(f'   최종 볼륨 조정 {gain_db:+.1f} dB')

    print('5) 미리보기·영상이 함께 쓰는 AAC 만들기')
    PREVIEW_M4A.parent.mkdir(parents=True, exist_ok=True)
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(final_wav), '-c:a', 'aac', '-b:a', '256k',
         '-movflags', '+faststart', str(PREVIEW_M4A)])

    if '--no-mux' not in sys.argv:
        if not SILENT_MP4.exists():
            raise SystemExit(f'무음 영상이 없다: {SILENT_MP4} (node tools/render-mp4.mjs 로 먼저 만든다)')
        print('6) 무음 MP4 + 오디오 합치기 (영상은 그대로 복사)')
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(SILENT_MP4), '-i', str(PREVIEW_M4A),
             '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy',
             '-movflags', '+faststart', str(OUT_MP4)])
        print('   →', OUT_MP4)
    print('끝')


if __name__ == '__main__':
    main()
