// 개인정보처리방침·이용약관을 **정적 HTML로도** 뽑아내는 Vite 플러그인.
//
// 왜 필요한가:
//   Google Play Console은 "공개적으로 접근 가능한 개인정보처리방침 URL"을 필수로 받는다.
//   그런데 이 앱은 커스텀 라우터라 URL이 하나뿐이라(모든 화면이 같은 주소)
//   앱 안의 방침 화면만으로는 심사 요건을 못 채운다.
//
// 원문은 src/data/policies.js 한 곳에만 두고 여기서 HTML로 변환한다.
//   → 앱 화면과 정적 페이지가 갈라질 일이 없다. 원문을 고치면 양쪽이 같이 바뀐다.
//
// 결과물: dist/privacy.html, dist/terms.html
// 접근 경로(/privacy, /terms)는 vercel.json의 rewrites가 연결한다.

import {
  PRIVACY_POLICY, TERMS, POLICY_CONTACT, POLICY_EFFECTIVE,
} from '../src/data/policies.js';

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 본문의 **강조**만 처리(앱 화면의 Emphasized 컴포넌트와 같은 규칙)
function emph(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function renderSection(s) {
  const out = [`<section><h2>${esc(s.h)}</h2>`];
  for (const p of s.p || []) out.push(`<p>${emph(p)}</p>`);
  if (s.ul) {
    out.push('<ul>');
    for (const li of s.ul) out.push(`<li>${emph(li)}</li>`);
    out.push('</ul>');
  }
  if (s.table) {
    out.push('<table><thead><tr><th>맡긴 곳</th><th>하는 일</th><th>서버 위치</th></tr></thead><tbody>');
    for (const r of s.table) {
      out.push(`<tr><td>${esc(r.name)}</td><td>${esc(r.role)}</td><td>${esc(r.place)}</td></tr>`);
    }
    out.push('</tbody></table>');
  }
  if (s.after) out.push(`<p class="after">${emph(s.after)}</p>`);
  out.push('</section>');
  return out.join('\n');
}

function renderContact() {
  if (POLICY_CONTACT.email) {
    const lines = [];
    if (POLICY_CONTACT.owner) lines.push(`<p>운영: ${esc(POLICY_CONTACT.owner)}</p>`);
    if (POLICY_CONTACT.manager) lines.push(`<p>개인정보 보호책임자: ${esc(POLICY_CONTACT.manager)}</p>`);
    lines.push(`<p><a href="mailto:${esc(POLICY_CONTACT.email)}">${esc(POLICY_CONTACT.email)}</a></p>`);
    return `<section><h2>문의</h2>${lines.join('\n')}</section>`;
  }
  // 연락처가 아직 없으면 있는 척하지 않는다(앱 화면과 같은 원칙).
  return `<section><h2>문의</h2><p>문의 창구를 준비하고 있어요. 급한 도움이 필요하면 청소년전화 <strong>1388</strong>이나 가까운 꿈드림센터로 연락해 주세요.</p></section>`;
}

const CSS = `
:root{--bg:#F1F5F9;--card:#fff;--text:#1F2733;--sub:#6B7686;--line:#E5EBF1;--brand:#2E8BD0;--soft:#EEF3F8}
*{box-sizing:border-box}
body{margin:0;padding:28px 18px 64px;background:var(--bg);color:var(--text);
  font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  line-height:1.75;-webkit-text-size-adjust:100%}
main{max-width:720px;margin:0 auto;background:var(--card);border:1px solid var(--line);
  border-radius:16px;padding:28px 22px}
h1{font-size:22px;margin:0 0 6px;letter-spacing:-.3px}
.lead{margin:0 0 22px;color:var(--sub);font-size:14px}
h2{font-size:15.5px;margin:26px 0 8px;letter-spacing:-.2px}
p,li{font-size:14px;color:var(--sub)}
p{margin:0 0 8px}
strong{color:var(--text)}
ul{margin:0 0 8px;padding-left:20px}
li{margin-bottom:4px}
.after{margin-top:8px;padding:10px 12px;border-radius:10px;background:var(--soft);font-size:13px}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:13px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left}
th{background:var(--soft);color:var(--text);font-weight:700}
a{color:var(--brand)}
.effective{margin-top:28px;padding-top:14px;border-top:1px solid var(--line);
  font-size:12.5px;color:var(--sub);text-align:center}
.backlink{display:block;margin-top:18px;text-align:center;font-size:13px}
@media (prefers-color-scheme:dark){
  :root{--bg:#12161c;--card:#1a1f27;--text:#e8ecf2;--sub:#a3adbb;--line:#2a323d;--soft:#222933}
}
`;

function page(doc, canonical) {
  const isPrivacy = doc === 'privacy';
  const data = isPrivacy ? PRIVACY_POLICY : TERMS;
  const body = data.sections.map(renderSection).join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.title)} — 검고담임</title>
<meta name="description" content="검고담임(검정고시생·학교 밖 청소년 입시·진로 안내)의 ${esc(data.title)}입니다.">
<link rel="canonical" href="${esc(canonical)}">
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(data.title)}</h1>
<p class="lead">${esc(data.lead)}</p>
${body}
${renderContact()}
<p class="effective">시행일: ${esc(POLICY_EFFECTIVE)}</p>
<a class="backlink" href="/">검고담임으로 돌아가기</a>
</main>
</body>
</html>`;
}

const SITE = 'https://gumgomentor.vercel.app';

/** @returns {import('vite').Plugin} */
export function policyPages() {
  return {
    name: 'rebridge-policy-pages',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'privacy.html', source: page('privacy', `${SITE}/privacy`) });
      this.emitFile({ type: 'asset', fileName: 'terms.html',   source: page('terms',   `${SITE}/terms`) });
    },
  };
}
