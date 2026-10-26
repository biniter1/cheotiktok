-- Người dùng (1 tài khoản TikTok = 1 user, khoá theo open_id)
create table users (
  id            bigserial primary key,
  open_id       text not null unique,
  display_name  text,
  username      text,
  avatar_url    text,
  profile_url   text,
  trust_score   int  not null default 50 check (trust_score between 0 and 100),
  warning       boolean not null default false,
  status        text not null default 'active' check (status in ('active','suspended','banned')),
  banned_until  timestamptz,
  role          text not null default 'user' check (role in ('user','admin')),
  tracking_ok   boolean not null default true,   -- false khi user thu hồi quyền / token chết
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Token TikTok, đã mã hoá AES-GCM ở tầng ứng dụng
create table oauth_tokens (
  user_id            bigint primary key references users(id) on delete cascade,
  access_enc         text not null,
  refresh_enc        text not null,
  access_expires_at  timestamptz not null,
  refresh_expires_at timestamptz not null,
  scope              text not null,
  updated_at         timestamptz not null default now()
);

-- Chuỗi thời gian số follower/following (production: partition theo tháng)
create table stat_snapshots (
  id              bigserial primary key,
  user_id         bigint not null references users(id) on delete cascade,
  follower_count  int not null,
  following_count int not null,
  taken_at        timestamptz not null default now()
);
create index stat_snapshots_user_time on stat_snapshots (user_id, taken_at desc);

-- Phiên ghép cặp
create table matches (
  id                bigserial primary key,
  user_a            bigint not null references users(id),
  user_b            bigint not null references users(id),
  a_base_following  int not null,
  b_base_following  int not null,
  a_confirmed       boolean not null default false,
  b_confirmed       boolean not null default false,
  a_followed        boolean,
  b_followed        boolean,
  status            text not null default 'pending'
                    check (status in ('pending','verifying','ok','partial','failed','expired')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index matches_pending on matches (status) where status in ('pending','verifying');

-- Quan hệ follow được hệ thống xác minh (follower -> followee)
create table follows (
  follower_id bigint not null references users(id),
  followee_id bigint not null references users(id),
  since       timestamptz not null default now(),
  status      text not null default 'active' check (status in ('active','broken')),
  broken_at   timestamptz,
  bonus7      boolean not null default false,
  bonus30     boolean not null default false,
  primary key (follower_id, followee_id)
);
create index follows_followee_active on follows (followee_id) where status = 'active';

-- Sự kiện tụt follower
create table drop_events (
  id           bigserial primary key,
  user_id      bigint not null references users(id),
  prev_count   int not null,
  new_count    int not null,
  window_start timestamptz not null,
  window_end   timestamptz not null,
  correlated   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Nghi phạm unfollow (kết quả đối chiếu chéo)
create table suspicions (
  id              bigserial primary key,
  drop_event_id   bigint not null references drop_events(id),
  victim_id       bigint not null references users(id),
  suspect_id      bigint not null references users(id),
  following_delta int not null,
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','dismissed','overturned','expired')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  unique (drop_event_id, suspect_id)
);
create index suspicions_victim_pending on suspicions (victim_id) where status = 'pending';
create index suspicions_suspect on suspicions (suspect_id, status);

-- Report (có bằng chứng = gắn suspicion_id, không có = report tay)
create table reports (
  id            bigserial primary key,
  reporter_id   bigint not null references users(id),
  target_id     bigint not null references users(id),
  suspicion_id  bigint references suspicions(id),
  note          text,
  weight        numeric(4,2) not null,
  status        text not null default 'open' check (status in ('open','upheld','rejected')),
  created_at    timestamptz not null default now()
);
create index reports_target on reports (target_id, created_at);

-- Kháng cáo
create table appeals (
  id            bigserial primary key,
  user_id       bigint not null references users(id),
  suspicion_id  bigint not null references suspicions(id) unique,
  note          text,
  evidence_url  text,
  status        text not null default 'open' check (status in ('open','accepted','rejected')),
  resolved_by   bigint references users(id),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- Sổ cái điểm tin cậy (mọi thay đổi đều để lại dấu vết, phục vụ audit/kháng cáo)
create table trust_ledger (
  id         bigserial primary key,
  user_id    bigint not null references users(id),
  delta      int not null,
  reason     text not null,
  ref_id     bigint,
  created_at timestamptz not null default now()
);
create index trust_ledger_user_time on trust_ledger (user_id, created_at desc);
