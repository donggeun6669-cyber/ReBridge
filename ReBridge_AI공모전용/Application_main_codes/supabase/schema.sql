-- ============================================================================
-- ReBridge(검고담임) — 학교밖청소년 커뮤니티 백엔드 스키마
-- 대상: Supabase(Postgres + Auth + RLS). 무료 플랜으로 충분.
-- ----------------------------------------------------------------------------
-- 세팅 방법(최초 1회)
--   1) https://supabase.com 에서 프로젝트 생성(무료).
--   2) 좌측 SQL Editor에 이 파일 전체를 붙여넣고 RUN.
--   3) Authentication > Providers > "Anonymous sign-ins" 를 켠다.
--      (이 앱은 이메일 없이 '익명 로그인 + 닉네임'으로 가입한다. 익명성 최우선.)
--   4) Project Settings > API 에서 'Project URL'과 'anon public' 키를 복사해
--      앱 .env 에 넣는다:
--        VITE_SUPABASE_URL=https://xxxx.supabase.co
--        VITE_SUPABASE_ANON_KEY=eyJ...
--      ※ anon 키는 공개돼도 안전하다(아래 RLS가 모든 쓰기를 막는다).
--   5) .env 가 비어 있으면 앱은 자동으로 localStorage 목(mock) 백엔드로 폴백한다.
-- ============================================================================

-- gen_random_uuid() 사용을 위해 pgcrypto 확장 보장(Supabase 무료 플랜 기본 포함).
create extension if not exists pgcrypto;

-- 깨끗한 재실행을 위해(개발용). 운영에선 주의.
-- drop function if exists redeem_code(text);
-- drop table if exists reactions, comment_reactions, comments, bookmarks, reports, blocks, posts, verification_codes, profiles cascade;

-- ── 프로필 ───────────────────────────────────────────────────────────────
-- auth.users 와 1:1. 닉네임(실명 금지)과 인증 배지 상태를 담는다.
create table if not exists profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nickname       text not null check (char_length(nickname) between 1 and 20),
  verified       boolean not null default false,         -- 꿈드림 인증 배지 여부
  verified_center text,                                  -- 인증을 발급한 센터 id
  verified_at    timestamptz,
  is_staff       boolean not null default false,         -- 실무자(코드 발급 권한). roles 시스템이 세팅.
  created_at     timestamptz not null default now()
);

-- ── 인증코드 ─────────────────────────────────────────────────────────────
-- 실무자(staff)가 발급(insert), 학생이 redeem_code()로 사용. 코드 자체는 공개 조회 금지.
create table if not exists verification_codes (
  code        text primary key,                          -- 예: DREAM-AB12
  center_id   text not null,                             -- 발급 센터
  issued_by   text,                                      -- 발급 실무자 표시용
  used_by     uuid references auth.users (id),           -- 사용한 학생(없으면 미사용)
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ── 게시글 ───────────────────────────────────────────────────────────────
-- board: 'review'(꿈드림 후기) | 'talk'(이야기) | 'center'(우리 센터 — 인증자 전용)
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references profiles (id) on delete cascade,
  board       text not null check (board in ('review', 'talk', 'center')),
  title       text not null check (char_length(title) between 1 and 80),
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists posts_board_created_idx on posts (board, created_at desc);

-- ── P1(additive): 게시글에 태그·센터 보드 컬럼 추가 ───────────────────────────
-- 기존 board check 제약을 'center' 허용으로 교체(있으면 drop 후 재생성).
alter table posts add column if not exists tag       text;      -- talk 보드 주제: ged|career|free|worry
alter table posts add column if not exists center_id text;      -- board='center' 일 때 작성자 인증센터
do $$ begin
  alter table posts drop constraint if exists posts_board_check;
  alter table posts add  constraint posts_board_check
    check (board in ('review', 'talk', 'center'));
exception when others then null; end $$;
-- 검색용 인덱스(제목/본문 트라이그램). pg_trgm 확장이 없으면 조용히 건너뜀.
do $$ begin
  create extension if not exists pg_trgm;
  create index if not exists posts_title_trgm on posts using gin (title gin_trgm_ops);
  create index if not exists posts_body_trgm  on posts using gin (body  gin_trgm_ops);
exception when others then null; end $$;

-- ── 댓글 ─────────────────────────────────────────────────────────────────
-- parent_id: 대댓글(1단 답글)용. null=원댓글, 값 있으면 그 댓글의 답글.
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts (id) on delete cascade,
  author      uuid not null references profiles (id) on delete cascade,
  parent_id   uuid references comments (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_idx on comments (post_id, created_at);

-- ── P0 마이그레이션(기존 DB에 안전하게 컬럼 추가 — additive) ───────────────────
-- 이미 comments 테이블이 있는 프로젝트는 위 create 가 무시되므로, 컬럼을 따로 추가.
alter table comments add column if not exists parent_id uuid references comments (id) on delete cascade;
create index if not exists comments_parent_idx on comments (parent_id);

-- ── 공감(좋아요) ─────────────────────────────────────────────────────────
create table if not exists reactions (
  post_id    uuid not null references posts (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ── P0: 댓글 공감(♥) ─────────────────────────────────────────────────────
create table if not exists comment_reactions (
  comment_id uuid not null references comments (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- ── P1(additive): 스크랩/신고/차단 ──────────────────────────────────────────
-- 스크랩(저장): 본인만 자기 북마크를 읽고/쓴다.
create table if not exists bookmarks (
  user_id    uuid not null references profiles (id) on delete cascade,
  post_id    uuid not null references posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists bookmarks_user_idx on bookmarks (user_id, created_at desc);

-- 신고: 신고자만 insert(공개 조회 금지 — 운영자/RPC로만 열람).
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam','abuse','privacy','adult','etc')),
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists reports_target_idx on reports (target_type, target_id);

-- 차단: 본인(blocker)만 자기 차단목록을 읽고/쓴다. 숨김 처리는 클라이언트에서.
create table if not exists blocks (
  blocker    uuid not null references profiles (id) on delete cascade,
  blocked    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- ============================================================================
-- RLS — 읽기는 누구나(익명 열람), 쓰기는 로그인 + 본인 것만.
-- ============================================================================
alter table profiles           enable row level security;
alter table verification_codes enable row level security;
alter table posts              enable row level security;
alter table comments           enable row level security;
alter table reactions          enable row level security;
alter table comment_reactions  enable row level security;
alter table bookmarks          enable row level security;
alter table reports            enable row level security;
alter table blocks             enable row level security;

-- 프로필: 공개 읽기(닉네임·배지 표시용), 본인만 생성/수정.
create policy "profiles read"   on profiles for select using (true);
create policy "profiles insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles update" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id
    -- 본인이 직접 인증/실무자 플래그를 못 켜게 막는다(RPC SECURITY DEFINER로만 변경).
    and verified = (select verified from profiles p where p.id = auth.uid())
    and is_staff = (select is_staff from profiles p where p.id = auth.uid()));

-- 인증코드: 일반 조회 금지(코드 유출 방지). 실무자만 insert / 본인 발급분 조회.
create policy "codes insert staff" on verification_codes for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_staff));
create policy "codes select staff" on verification_codes for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_staff));

-- 게시글: 공개 읽기, 로그인 사용자가 본인 명의로 작성, 본인 글만 삭제.
create policy "posts read"   on posts for select using (true);
create policy "posts insert" on posts for insert with check (auth.uid() = author);
create policy "posts delete" on posts for delete using (auth.uid() = author);

-- 댓글: 공개 읽기, 본인 명의 작성, 본인 댓글만 삭제.
create policy "comments read"   on comments for select using (true);
create policy "comments insert" on comments for insert with check (auth.uid() = author);
create policy "comments delete" on comments for delete using (auth.uid() = author);

-- 공감: 공개 읽기(카운트), 본인 것만 추가/취소.
create policy "reactions read"   on reactions for select using (true);
create policy "reactions insert" on reactions for insert with check (auth.uid() = user_id);
create policy "reactions delete" on reactions for delete using (auth.uid() = user_id);

-- 댓글 공감: 공개 읽기(카운트), 본인 것만 추가/취소.
create policy "comment_reactions read"   on comment_reactions for select using (true);
create policy "comment_reactions insert" on comment_reactions for insert with check (auth.uid() = user_id);
create policy "comment_reactions delete" on comment_reactions for delete using (auth.uid() = user_id);

-- ── P1 RLS(additive). 재실행 안전하게 do 블록으로 감싼다 ─────────────────────
-- 스크랩: 본인 것만 읽기/추가/삭제(비공개).
do $$ begin
  create policy "bookmarks own select" on bookmarks for select using (auth.uid() = user_id);
  create policy "bookmarks own insert" on bookmarks for insert with check (auth.uid() = user_id);
  create policy "bookmarks own delete" on bookmarks for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 신고: 본인 명의로 insert만. 일반 select 정책 없음 → 누구도 신고 내역을 읽지 못함(운영자는 service_role로).
do $$ begin
  create policy "reports insert" on reports for insert with check (auth.uid() = reporter);
exception when duplicate_object then null; end $$;

-- 차단: 본인(blocker) 것만 읽기/추가/삭제.
do $$ begin
  create policy "blocks own select" on blocks for select using (auth.uid() = blocker);
  create policy "blocks own insert" on blocks for insert with check (auth.uid() = blocker);
  create policy "blocks own delete" on blocks for delete using (auth.uid() = blocker);
exception when duplicate_object then null; end $$;

-- ============================================================================
-- RPC — 인증코드 사용(원자적). 학생은 코드 테이블을 직접 못 보지만 이 함수로 redeem.
--   · 미사용 코드면 used_by/used_at 기록 + 호출자 프로필을 verified 로 갱신.
--   · 이미 쓰였거나 없는 코드면 예외.
-- youthVerify.redeemCode() 가 supabase.rpc('redeem_code', { p_code }) 로 호출.
-- ============================================================================
create or replace function redeem_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_center text;
  v_rows   int;
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;

  -- 프로필이 먼저 있어야 인증 배지를 붙일 수 있다(닉네임 가입 선행).
  -- 프로필이 없으면 코드를 소모하지 않고 즉시 예외(트랜잭션 롤백).
  if not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'profile required';
  end if;

  update verification_codes
     set used_by = auth.uid(), used_at = now()
   where code = p_code and used_by is null
   returning center_id into v_center;

  if v_center is null then
    raise exception 'invalid or used code';
  end if;

  update profiles
     set verified = true, verified_center = v_center, verified_at = now()
   where id = auth.uid();
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    -- 방어적: 프로필 갱신이 0행이면 코드 소모까지 롤백(원자성 보장).
    raise exception 'profile update failed';
  end if;

  return json_build_object('ok', true, 'center', v_center);
end;
$$;

-- 익명/로그인 사용자가 redeem_code 만 호출하도록 권한을 명시(코드 테이블은 직접 못 봄).
revoke all on function redeem_code(text) from public;
grant execute on function redeem_code(text) to anon, authenticated;
