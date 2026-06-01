# Proposal: Webapp LotusTime: Xếp Thời Khóa Biểu — Trung Tâm Anh Ngữ

**Phiên bản:** 0.2  
**Ngày:** Tháng 6, 2025  
**Changelog v0.2:** Cập nhật tech stack (Gemini, Railway, Vercel), bổ sung data model đầy đủ, logic "pin session", role linh hoạt GV/TA.

---

## 1. Bối Cảnh & Vấn Đề

Trung tâm hiện đang xếp TKB hoàn toàn thủ công bằng Excel. Qua phân tích file thực tế (`Schedule_updated_2025.xlsx`), có thể thấy rõ mức độ phức tạp:

- **~26 lớp học** (L01–L26) cộng thêm các lớp Cambridge (Movers, Flyers, Starters) và IELTS chạy song song
- **~15 giáo viên & TA** với lịch khả dụng khác nhau hoàn toàn
- **5 phòng học** phải phân bổ không trùng lặp
- **Lịch thay đổi liên tục** — mỗi tuần có điều chỉnh, đặc biệt mùa hè khi TA tham gia
- **Nhiều sheet chồng chéo**: TKB theo tuần, theo lớp, theo GV, theo ngày — thông tin phân tán, dễ nhầm lẫn

Chủ trung tâm tự xếp TKB, tốn nhiều thời gian và dễ xảy ra xung đột (2 lớp tranh 1 phòng, GV bị double-book, TA sinh viên bận đột xuất).

---

## 2. Mục Tiêu Sản Phẩm

Xây dựng **một webapp đơn giản, ổn định**, tập trung vào **một chức năng duy nhất**: xếp TKB tự động có hỗ trợ ràng buộc thông minh.

- **Không phải** hệ thống quản lý học sinh toàn diện
- **Không phải** app cho phụ huynh hay giáo viên tự đăng nhập
- **Chỉ là** công cụ nội bộ giúp chủ trung tâm xếp TKB nhanh, đúng, không xung đột

---

## 3. Tech Stack (Đã Confirm)

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | React + Vite | Hosting trên **Vercel** |
| Backend | Node.js (Express) | Hosting trên **Railway** |
| Database | PostgreSQL | Managed trên Railway |
| Scheduling | **Google OR-Tools** (via Python subprocess hoặc REST microservice) | CSP solver mạnh, open-source |
| LLM | **Google Gemini gemini-2.5-flash** | Parse ràng buộc tự nhiên, giải thích conflict |
| Export | ExcelJS + PDFKit | Xuất file phía backend |

> **Lưu ý OR-Tools:** Thư viện này là Python-native. Từ Node.js có 2 cách gọi: (1) spawn Python subprocess, (2) tách ra microservice Python nhỏ riêng trên Railway. Option 2 sạch hơn và dễ scale.

---

## 4. Phân Tích Nghiệp Vụ Chi Tiết

### 4.1 Nghiệp Vụ Role GV/TA (Cập nhật)

Một người có thể đảm nhận **nhiều role** tùy lớp và tùy buổi:

| Role | Ý nghĩa |
|---|---|
| `lead_teacher` | Dạy chính, chịu trách nhiệm nội dung toàn buổi |
| `ta_support` | Hỗ trợ GV chính trong lớp (thường là lớp kids) |
| `ta_solo` | Dạy một mình (tiết TA riêng, thường là ôn luyện) |
| `ta_ielts` | Hỗ trợ Speaking/Writing trong lớp ôn thi IELTS |

Ví dụ từ file thực tế: Ms. Jasmine vừa là `lead_teacher` cho L01, L07, L14, vừa có thể làm `ta_support` trong các slot khác. Mark vừa dạy chính L08, L21, vừa là TA cho L09, L12, L20.

**Điều này ảnh hưởng đến constraint:**
- Một người chỉ bị "conflict" nếu 2 assignment của họ **overlap về thời gian**
- Role khác nhau ở 2 slot khác giờ thì hoàn toàn hợp lệ

### 4.2 Logic "Pin Session" (Tính Năng Mới)

Khi chạy xếp TKB tuần mới, một số lớp đã có slot ổn định từ tuần trước (đúng giờ, đúng phòng, GV không thay đổi). Thay vì phải xếp lại từ đầu, hệ thống cho phép **"pin"** các session đó — giữ nguyên và chỉ xếp những lớp còn lại.

**Điều kiện để pin hợp lệ:**
1. GV được assign vẫn available trong khung giờ đó tuần mới
2. Phòng vẫn trống trong slot đó
3. Không vi phạm bất kỳ hard constraint nào khác

**Luồng sử dụng:**
```
Bắt đầu tuần mới
  → Hệ thống đề xuất: "12 sessions từ tuần trước vẫn hợp lệ — pin hết?"
  → Chủ trung tâm review, bỏ pin những cái muốn xếp lại
  → Chạy solver chỉ với các lớp chưa có slot
```

### 4.3 Ba Kiểu Deploy TA Mùa Hè

1. **Tiết TA riêng (`ta_solo`)** — TA dạy độc lập một buổi ôn luyện
2. **TA join lớp kids (`ta_support`)** — TA vào cùng GV chính, hỗ trợ trực tiếp học sinh nhỏ
3. **TA join lớp ôn thi (`ta_ielts`)** — TA hỗ trợ luyện kỹ năng trong lớp IELTS/Cambridge

TA là sinh viên, lịch bất định → **bắt buộc nhập availability mỗi tuần** trước khi chạy solver.

### 4.4 Phân Loại Ràng Buộc

| Loại | Ví dụ | Cách xử lý trong OR-Tools |
|---|---|---|
| **Hard** | GV/TA không overlap 2 assignment | `AddNoOverlap` hoặc boolean exclusion |
| **Hard** | Phòng không trùng slot | `AddNoOverlap` trên resource "room" |
| **Hard** | GV/TA chỉ available theo khung giờ đã đăng ký | Forbidden intervals |
| **Hard** | Lớp phải đủ số buổi/tuần | `Add(sum == required_sessions)` |
| **Hard** | Session bị pin → giữ nguyên | Fix variable = giá trị đã chọn |
| **Soft** | Anh em học cùng buổi | Penalty nếu không cùng slot |
| **Soft** | Học sinh ở xa cần buổi sáng | Penalty nếu slot chiều |
| **Soft** | TA nên được ghép vào lớp kids | Bonus nếu match |
| **Soft** | Phân bổ tải GV đều nhau | Minimize max deviation |

---

## 5. Data Model Chi Tiết

### 5.1 Sơ Đồ Quan Hệ (ERD — tóm tắt)

```
Person ──< PersonClassRole >── Class
Person ──< Availability
Class ──< Session >── Room
Session ──< SessionAssignment >── Person
ScheduleWeek ──< Session
SpecialConstraint ── (linked to Person / Class / Student)
Student ──< StudentGroup (anh em cùng đi học)
```

### 5.2 Bảng Chi Tiết

---

#### `persons` — Người dạy (GV + TA, unified)

```sql
CREATE TABLE persons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  short_name    TEXT NOT NULL UNIQUE,     -- VD: "K.Q", "Jasmine", "Mark"
  email         TEXT,
  phone         TEXT,
  is_active     BOOLEAN DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

> Không phân biệt "GV" hay "TA" ở cấp person. Role được xác định lúc assign vào session.

---

#### `person_capabilities` — Năng lực / phân loại của từng người

```sql
CREATE TABLE person_capabilities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    UUID REFERENCES persons(id) ON DELETE CASCADE,
  capability   TEXT NOT NULL,
  -- VD: 'lead_teacher', 'ta_support', 'ta_solo', 'ta_ielts', 'art_teacher'
  -- Một người có thể có nhiều capability
  UNIQUE (person_id, capability)
);
```

---

#### `person_class_permissions` — Người này được phép dạy/hỗ trợ lớp nào

```sql
CREATE TABLE person_class_permissions (
  person_id    UUID REFERENCES persons(id) ON DELETE CASCADE,
  class_id     UUID REFERENCES classes(id) ON DELETE CASCADE,
  allowed_roles TEXT[] NOT NULL,
  -- VD: ['lead_teacher'], hoặc ['ta_support', 'ta_solo']
  PRIMARY KEY (person_id, class_id)
);
```

---

#### `rooms` — Phòng học

```sql
CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,   -- "Room 1", "Room 2", "Admin Room"...
  capacity     INT,
  is_active    BOOLEAN DEFAULT true
);
```

---

#### `classes` — Lớp học

```sql
CREATE TABLE classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,  -- "L01", "L12", "Camb.Movers"...
  class_type        TEXT NOT NULL,
  -- 'regular' | 'kids' | 'cambridge' | 'ielts' | 'art'
  level             TEXT,                  -- "Gr.9", "IELTS 6.5", "Starters"...
  sessions_per_week INT NOT NULL DEFAULT 2,
  duration_minutes  INT NOT NULL,          -- Thời lượng 1 buổi (90, 150, 270...)
  requires_ta       BOOLEAN DEFAULT false, -- Lớp kids thường cần TA
  is_active         BOOLEAN DEFAULT true,
  notes             TEXT
);
```

---

#### `students` — Học sinh (chỉ cần cho soft constraint "anh em")

```sql
CREATE TABLE students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT NOT NULL,
  class_id   UUID REFERENCES classes(id),
  family_id  UUID,   -- NULL nếu không có ràng buộc gia đình
  notes      TEXT    -- VD: "nhà ở Đức Hòa, cần buổi sáng"
);
```

---

#### `family_groups` — Nhóm anh em cùng phụ huynh

```sql
CREATE TABLE family_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT,              -- VD: "Gia đình Nguyễn - 2 con"
  preference  TEXT               -- VD: "same_session" | "morning_only"
);
```

> `students.family_id` → `family_groups.id`. Solver sẽ cố xếp các học sinh cùng `family_id` vào session trùng buổi (same day + overlapping time).

---

#### `schedule_weeks` — Mỗi tuần xếp TKB là 1 record

```sql
CREATE TABLE schedule_weeks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL UNIQUE,   -- Ngày thứ 2 đầu tuần
  status       TEXT DEFAULT 'draft',
  -- 'draft' | 'solving' | 'review' | 'published'
  created_at   TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);
```

---

#### `availabilities` — Khung giờ available của từng người, theo tuần

```sql
CREATE TABLE availabilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     UUID REFERENCES persons(id) ON DELETE CASCADE,
  week_id       UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  day_of_week   INT NOT NULL,       -- 2=Thứ 2 ... 8=Chủ nhật (hoặc 0–6)
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  CONSTRAINT no_overlap UNIQUE (person_id, week_id, day_of_week, start_time)
);
```

> GV cơ hữu có availability ổn định → có thể copy từ tuần trước.
> TA sinh viên phải nhập mỗi tuần.

---

#### `sessions` — Các buổi học được xếp trong 1 tuần

```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id         UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES classes(id),
  room_id         UUID REFERENCES rooms(id),
  day_of_week     INT NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_pinned       BOOLEAN DEFAULT false,
  -- true = giữ nguyên từ tuần trước, solver không được thay đổi
  pin_reason      TEXT,
  -- VD: "GV và phòng đều ok, lịch ổn định"
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

#### `session_assignments` — Ai được assign vào buổi học nào, với role gì

```sql
CREATE TABLE session_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  person_id   UUID REFERENCES persons(id),
  role        TEXT NOT NULL,
  -- 'lead_teacher' | 'ta_support' | 'ta_solo' | 'ta_ielts'
  is_confirmed BOOLEAN DEFAULT false
  -- false = solver đề xuất, true = chủ trung tâm đã duyệt
);
```

---

#### `special_constraints` — Ràng buộc đặc biệt (nhập tay hoặc qua LLM)

```sql
CREATE TABLE special_constraints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id         UUID REFERENCES schedule_weeks(id),
  -- NULL = áp dụng mọi tuần
  raw_text        TEXT NOT NULL,
  -- Text gốc người dùng nhập: "Lan và Minh học cùng buổi"
  parsed_json     JSONB,
  -- Output của Gemini sau khi parse, VD:
  -- { "type": "same_session", "entities": ["student:Lan", "student:Minh"] }
  constraint_type TEXT,
  -- 'same_session' | 'morning_only' | 'afternoon_only' | 'avoid_day' | 'custom'
  priority        INT DEFAULT 5,       -- 1 (thấp) → 10 (cao)
  is_active       BOOLEAN DEFAULT true,
  confirmed_by_user BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

#### `solver_runs` — Log mỗi lần chạy solver

```sql
CREATE TABLE solver_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       UUID REFERENCES schedule_weeks(id),
  started_at    TIMESTAMPTZ DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT,   -- 'running' | 'optimal' | 'feasible' | 'infeasible' | 'error'
  pinned_count  INT,    -- Số session bị pin (không xếp lại)
  solved_count  INT,    -- Số session solver tự xếp
  objective_score FLOAT,
  conflict_details JSONB
  -- VD: [{ "class": "L03", "reason": "Không có GV available ngày Thứ 3 sáng" }]
);
```

---

### 5.3 Tóm Tắt Quan Hệ

```
persons
  ├── person_capabilities       (1 người, nhiều capability)
  ├── person_class_permissions  (1 người, được dạy nhiều lớp với role cụ thể)
  └── availabilities            (theo từng tuần)

schedule_weeks
  └── sessions
        ├── session_assignments  (ai dạy, role gì)
        └── [is_pinned = true]   (session bị giữ nguyên)

classes
  └── students
        └── family_groups        (nhóm anh em)

special_constraints              (linked to week hoặc global)
solver_runs                      (log kết quả mỗi lần chạy)
```

---

## 6. Luồng Sử Dụng (Cập Nhật)

### Tuần mới — flow đầy đủ

```
1. Tạo schedule_week mới (chọn ngày bắt đầu tuần)

2. Cập nhật availability
   ├── GV cơ hữu: copy từ tuần trước → review → điều chỉnh nếu có thay đổi
   └── TA sinh viên: nhập mới (bắt buộc)

3. Review pin suggestions
   └── Hệ thống kiểm tra sessions tuần trước → đề xuất danh sách hợp lệ để pin
   └── Chủ trung tâm tick/bỏ tick → confirm

4. Nhập ràng buộc đặc biệt (nếu tuần này có mới)
   └── Text tự nhiên → Gemini parse → hiển thị confirm → lưu

5. Chạy solver (OR-Tools)
   └── Chỉ xếp các sessions chưa pin
   └── Tối ưu soft constraints

6. Review kết quả trên TKB Grid
   └── Cảnh báo nếu có session infeasible
   └── Kéo thả chỉnh tay nếu cần

7. Publish + Export
   ├── Export Excel (theo GV, theo lớp, tổng hợp)
   └── Export PDF để in hoặc gửi zalo
```

---

## 7. Màn Hình Chính (Screens)

| Màn hình | Mô tả |
|---|---|
| **Dashboard** | Tổng quan tuần: lớp chưa xếp, conflict, pin count, trạng thái solver |
| **TKB Grid** | View theo tuần — cột = ngày, hàng = khung giờ, cell = lớp/phòng/GV + badge role |
| **Quản lý Người Dạy** | CRUD persons, gán capability, gán permission theo lớp |
| **Availability** | Nhập/copy availability theo tuần — phân biệt rõ GV cơ hữu vs TA |
| **Quản lý Lớp** | CRUD lớp, số buổi, thời lượng, loại lớp, học sinh |
| **Gia đình & Ràng buộc** | Nhập nhóm anh em, ràng buộc tự nhiên qua Gemini |
| **Pin Review** | Danh sách sessions đề xuất pin — tick/bỏ tick trước khi chạy solver |
| **Solver** | Chạy, xem log, xem conflict details |
| **Export** | Chọn view và định dạng, download |

---

## 8. API Endpoints Chính (Backend)

```
POST   /api/weeks                          Tạo tuần mới
GET    /api/weeks/:id/pin-suggestions      Lấy danh sách sessions đề xuất pin
POST   /api/weeks/:id/pin                  Confirm danh sách pin

GET    /api/persons                        Danh sách người dạy
POST   /api/persons                        Thêm người
PUT    /api/persons/:id/capabilities       Cập nhật capabilities
PUT    /api/persons/:id/permissions        Cập nhật class permissions

POST   /api/weeks/:id/availability         Nhập/cập nhật availability

POST   /api/constraints/parse              Gửi text → Gemini → trả parsed JSON
POST   /api/constraints                    Lưu constraint đã confirm

POST   /api/weeks/:id/solve                Trigger solver (async)
GET    /api/weeks/:id/solver-status        Poll kết quả solver

GET    /api/weeks/:id/sessions             Lấy toàn bộ sessions đã xếp
PATCH  /api/sessions/:id                   Chỉnh tay 1 session (kéo thả)

GET    /api/weeks/:id/export/excel         Download Excel
GET    /api/weeks/:id/export/pdf           Download PDF
```

---

## 9. Rủi Ro & Lưu Ý

| Rủi ro | Mức độ | Mitigation |
|---|---|---|
| OR-Tools là Python, backend là Node.js | Trung bình | Tách microservice Python riêng trên Railway, giao tiếp qua HTTP nội bộ |
| Solver không tìm được lịch thỏa mãn | Trung bình | Trả về `conflict_details` rõ ràng, gợi ý relax constraint nào |
| TA thay đổi availability sau khi đã pin | Cao | Validate lại pin khi availability thay đổi, cảnh báo ngay |
| Gemini parse sai ràng buộc | Thấp–TB | Luôn hiển thị `parsed_json` để user confirm trước khi lưu |
| Session pinned vi phạm constraint mới | Thấp | Validate toàn bộ pinned sessions mỗi lần chạy solver |

---

## 10. Phạm Vi MVP vs. Tương Lai

### MVP (4–6 tuần)
- CRUD: persons (với capability + permission), rooms, classes, students cơ bản
- Nhập availability theo tuần
- Pin suggestion + confirm
- Chạy solver OR-Tools (hard constraints)
- TKB Grid — view + kéo thả chỉnh tay
- Export Excel

### Phase 2
- Soft constraints đầy đủ (family groups, morning preference)
- Gemini parse ràng buộc ngôn ngữ tự nhiên
- Gợi ý slot cho TA
- Export PDF

### Phase 3
- Copy availability thông minh (detect GV nào ổn định, GV nào hay đổi)
- Multi-user — GV tự cập nhật availability
- Audit log thay đổi TKB
- Thông báo qua Zalo

---

*Proposal v0.2 — dựa trên phân tích file TKB thực tế, phỏng vấn nghiệp vụ, và các confirmation từ dev.*
