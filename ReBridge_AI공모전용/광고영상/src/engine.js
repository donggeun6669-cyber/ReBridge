// ───────────────────────────────────────────────────────────────
// 재생 엔진 — 화면은 '시간 t 하나'로만 그린다.
//   render(t) 는 t 만 보고 모든 요소의 위치·투명도를 정한다(이전 상태를 기억하지 않음).
//   그래서 아무 시점으로 옮겨도 그 순간이 똑같이 나오고, 반복 재생해도 겹치지 않는다.
//
// 주소 뒤에 붙이는 옵션
//   ?mode=capture   촬영 모드 — 조작부·시간 표시를 숨기고 처음부터 반복 재생
//   &t=12.5         그 시점에서 멈춘 채 연다
//   &autoplay=0     자동 재생하지 않는다(렌더러가 한 프레임씩 넘길 때)
// ───────────────────────────────────────────────────────────────
(function () {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;

  // 가감속 — 바운스 없는 부드러운 곡선만 쓴다
  const E = {
    linear: (u) => u,
    in: (u) => u * u * u,
    out: (u) => 1 - Math.pow(1 - u, 3),
    inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    outQuint: (u) => 1 - Math.pow(1 - u, 5),
    inOutQuint: (u) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2),
    inOutSine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  };

  // a~b 구간의 진행도 0..1
  const prog = (t, a, b, ease = E.inOut) =>
    (b <= a ? (t >= b ? 1 : 0) : ease(clamp((t - a) / (b - a), 0, 1)));

  // 키프레임 [[시간, 값], ...] — 값은 숫자나 숫자 배열. 구간마다 ease를 바꿀 수 있다: [시간, 값, ease]
  function K(t, keys, ease = E.inOut) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i];
      const [t1, v1, e1] = keys[i + 1];
      if (t <= t1) {
        const u = prog(t, t0, t1, e1 || ease);
        return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], u)) : lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  }

  // 요소 만들기 — 글자는 textContent 로만 넣는다
  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // 보이지 않는 요소는 그리지 않는다 — opacity 0 이면 visibility hidden.
  // 보일 때는 'visible'이 아니라 빈 값(부모를 따름)으로 둔다. 그래야 부모를 숨기면 자식도 같이 숨는다.
  function show(e, o) {
    const v = o > 0.001;
    if (e._vis !== v) { e.style.visibility = v ? '' : 'hidden'; e._vis = v; }
    const s = v && o < 0.999 ? o.toFixed(4) : '';
    if (e._o !== s) { e.style.opacity = s; e._o = s; }
    return v;
  }
  function tf(e, s) { if (e._tf !== s) { e.style.transform = s; e._tf = s; } }

  window.ADK = { clamp, lerp, E, prog, K, el, sv, show, tf };

  // ── 미리 불러오기: 글꼴·이미지를 다 받은 뒤에 시작해 타이밍이 밀리지 않게 ──
  async function preload(urls) {
    const fontLoads = [400, 500, 600, 700, 800, 900].map((w) =>
      document.fonts.load(`${w} 40px "Wanted Sans Variable"`, '검고담임 대학 0123'));
    const imgLoads = urls.map((u) => new Promise((res) => {
      const im = new Image();
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res({ u, ok: true }));
      im.onerror = () => res({ u, ok: false });
      im.src = u;
      (window.__adKeep = window.__adKeep || []).push(im); // 캐시에서 빠지지 않게 붙잡아 둔다
    }));
    await Promise.all(fontLoads);
    await document.fonts.ready;
    const imgs = await Promise.all(imgLoads);
    const failed = imgs.filter((r) => !r.ok).map((r) => r.u);
    const fontOk = document.fonts.check('800 40px "Wanted Sans Variable"', '검고담임');
    return { failed, fontOk, images: imgs.length };
  }

  // ── 플레이어 ──
  window.AdPlayer = async function AdPlayer({ duration, scenes, build, render, assets }) {
    const q = new URLSearchParams(location.search);
    const capture = q.get('mode') === 'capture';
    const autoplay = q.get('autoplay') !== '0';
    const startT = q.has('t') ? clamp(parseFloat(q.get('t')) || 0, 0, duration) : 0;
    document.documentElement.classList.toggle('is-capture', capture);

    const stage = document.getElementById('stage');
    const bar = document.getElementById('controls');
    if (!capture) bar.hidden = false;
    const fit = () => {
      const bh = capture ? 0 : bar.offsetHeight;
      const W = window.innerWidth, H = window.innerHeight - bh;
      const s = Math.min(W / 1920, H / 1080);
      stage.style.transform = `translate(${(W - 1920 * s) / 2}px, ${(H - 1080 * s) / 2}px) scale(${s})`;
    };
    window.addEventListener('resize', fit);
    fit();

    const status = await preload(assets);
    if (status.failed.length) console.error('[광고] 이미지를 못 불러옴:', status.failed);
    if (!status.fontOk) console.error('[광고] 글꼴(Wanted Sans)을 못 불러옴');
    build(stage);

    let t = startT, playing = false, loop = true, last = 0, raf = 0;

    // ── 소리 ──
    // 영상(MP4)에 들어간 것과 '같은 파일'을 쓴다. 큐를 두 벌로 관리하지 않는다.
    // 브라우저는 클릭 없이 소리를 못 내므로(자동재생 정책), 버튼을 눌러야 켜진다.
    // 촬영 모드·프레임 저장에서는 오디오를 아예 만들지 않는다.
    const AUDIO_SRC = 'assets/audio/ad-mix-50s.m4a';
    const audio = {
      el: null, on: false, vol: 0.85,
      make() {
        if (this.el || capture) return this.el;
        const a = new Audio(AUDIO_SRC);
        a.preload = 'auto';
        a.volume = this.vol;
        a.addEventListener('ended', () => {            // 반복 재생: 같은 요소를 되감아 쓴다(중복 생성 금지)
          if (loop && playing) { a.currentTime = 0; a.play().catch(() => {}); t = 0; }
          else { api.pause(); }
        });
        a.addEventListener('error', () => {
          console.error('[광고] 소리 파일을 못 불러옴:', AUDIO_SRC, '— python3 tools/make-audio.py 로 만든다');
          this.on = false; if (ui) ui.sync();
        });
        bar.appendChild(a);   // 조작부(광고 화면 밖)에 둔다 — 보이지는 않지만 점검 때 찾을 수 있다
        this.el = a;
        return a;
      },
      async enable() {
        const a = this.make();
        if (!a) return false;
        a.currentTime = Math.min(t, duration - 0.05);
        try { await a.play(); } catch (e) { console.warn('[광고] 소리 재생이 막혔다:', e.message); return false; }
        if (!playing) a.pause();
        this.on = true;
        return true;
      },
      disable() { this.on = false; if (this.el) this.el.pause(); },
      sync() { if (this.on && this.el) this.el.currentTime = Math.min(t, duration - 0.05); },
      setVol(v) { this.vol = v; if (this.el) this.el.volume = v; },
    };

    const ui = capture ? null : makeUI();
    fit(); // 장면 버튼이 들어가 조작부 높이가 바뀌었으니 다시 맞춘다

    function draw() { render(t); if (ui) ui.sync(); }
    function frame(now) {
      if (!playing) return;
      const a = audio.on && audio.el && !audio.el.paused && audio.el.readyState >= 2 ? audio.el : null;
      if (a) {
        t = Math.min(a.currentTime, duration);        // 소리를 기준 시계로 → 그림이 밀리지 않는다
      } else {
        const dt = Math.min(0.1, (now - last) / 1000); // 탭이 멈췄다 돌아와도 크게 건너뛰지 않게
        t += dt;
      }
      last = now;
      if (t >= duration) {
        if (loop) { t %= duration; audio.sync(); }
        else { t = duration; playing = false; if (audio.el) audio.el.pause(); }
      }
      draw();
      if (playing) raf = requestAnimationFrame(frame);
    }
    const api = {
      duration, scenes, status,
      get time() { return t; },
      get playing() { return playing; },
      get loop() { return loop; },
      play() {
        if (playing) return;
        if (t >= duration) t = 0;
        playing = true; last = performance.now();
        if (audio.on && audio.el) { audio.sync(); audio.el.play().catch(() => {}); }
        raf = requestAnimationFrame(frame); draw();
      },
      pause() { playing = false; cancelAnimationFrame(raf); if (audio.el) audio.el.pause(); draw(); },
      toggle() { if (playing) api.pause(); else api.play(); },
      seek(v) { t = clamp(v, 0, duration); audio.sync(); draw(); return t; },
      restart() { t = 0; audio.sync(); draw(); if (!playing) api.play(); },
      setLoop(v) { loop = !!v; if (ui) ui.sync(); },
      // 소리: 버튼(사용자 클릭)으로만 켠다
      get sound() { return audio.on; },
      async enableSound() { const okk = await audio.enable(); if (ui) ui.sync(); return okk; },
      disableSound() { audio.disable(); if (ui) ui.sync(); },
      setVolume(v) { audio.setVol(clamp(v, 0, 1)); if (ui) ui.sync(); },
    };
    window.AD = api;
    draw();
    document.documentElement.classList.add('is-ready');
    if (autoplay && !q.has('t')) api.play();

    // ── 미리보기 조작부 (광고 화면 밖, 촬영 모드에서는 만들지 않는다) ──
    function makeUI() {
      const $ = (s) => bar.querySelector(s);
      const play = $('[data-a=play]'), range = $('[data-a=range]'), time = $('[data-a=time]');
      const loopBox = $('[data-a=loop]'), sceneBox = $('[data-a=scenes]');
      range.max = duration;
      scenes.forEach((s) => {
        const b = el('button', 'scene-btn', sceneBox, s.label);
        el('small', null, b, `${s.start}s`);
        b.type = 'button';
        b.addEventListener('click', () => { api.seek(s.start); });
        b.dataset.start = s.start; b.dataset.end = s.end;
      });
      const soundBtn = $('[data-a=sound]'), vol = $('[data-a=vol]');
      soundBtn.addEventListener('click', async () => {
        if (api.sound) api.disableSound();
        else { const okk = await api.enableSound(); if (!okk) soundBtn.textContent = '소리를 켤 수 없음'; }
      });
      vol.addEventListener('input', () => api.setVolume(parseFloat(vol.value)));
      play.addEventListener('click', () => api.toggle());
      $('[data-a=restart]').addEventListener('click', () => api.restart());
      range.addEventListener('input', () => { api.pause(); api.seek(parseFloat(range.value)); });
      loopBox.addEventListener('change', () => api.setLoop(loopBox.checked));
      $('[data-a=capture]').addEventListener('click', () => {
        const u = new URL(location.href); u.search = '?mode=capture'; window.open(u.href, '_blank');
      });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); api.toggle(); }
        else if (e.code === 'ArrowRight') { api.pause(); api.seek(t + (e.shiftKey ? 0.1 : 1)); }
        else if (e.code === 'ArrowLeft') { api.pause(); api.seek(t - (e.shiftKey ? 0.1 : 1)); }
        else if (e.code === 'Home') { api.pause(); api.seek(0); }
      });
      return {
        sync() {
          play.textContent = playing ? '일시정지' : '재생';
          soundBtn.textContent = api.sound ? '🔊 소리 켜짐' : '🔇 소리와 함께 재생';
          soundBtn.classList.toggle('on', api.sound);
          vol.value = audio.vol;
          play.setAttribute('aria-pressed', String(playing));
          if (document.activeElement !== range) range.value = t;
          time.textContent = `${t.toFixed(2)} / ${duration.toFixed(2)}초`;
          loopBox.checked = loop;
          sceneBox.querySelectorAll('.scene-btn').forEach((b) => {
            b.classList.toggle('on', t >= +b.dataset.start && t < +b.dataset.end);
          });
        },
      };
    }
    return api;
  };
})();
