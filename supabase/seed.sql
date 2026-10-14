-- Demo data for Classroom Hub.
-- Run this file in Supabase SQL Editor after schema.sql.
-- The UUIDs are fixed so the script is safe to run repeatedly.

insert into schools (id, owner_id, name, address, created_at)
values (
  '10000000-0000-0000-0000-000000000001',
  'demo-owner',
  'Trường THCS Hoàng Sa',
  'Quận 7, TP.HCM',
  now()
)
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address;

insert into classes (id, school_id, name, teacher_name, room, status, created_at)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '9A',
  'Nguyễn Thị Lan',
  'Phòng 304',
  'active',
  now()
)
on conflict (id) do update set
  school_id = excluded.school_id,
  name = excluded.name,
  teacher_name = excluded.teacher_name,
  room = excluded.room,
  status = excluded.status;

insert into students (id, class_id, full_name, phone, status, note, created_at)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Nguyễn Minh An', '0901234567', 'active', 'Học sinh tích cực, tham gia đầy đủ', now()),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Trần Bảo Bình', '0907654321', 'at-risk', 'Cần nhắc nhở về chuyên cần', now()),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Lê Gia Hân', '0912345678', 'active', 'Nhiệt tình trong hoạt động nhóm', now()),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Phạm Quốc Khang', '0923456789', 'inactive', 'Thiếu bài tập gần đây', now())
on conflict (id) do update set
  class_id = excluded.class_id,
  full_name = excluded.full_name,
  phone = excluded.phone,
  status = excluded.status,
  note = excluded.note;

insert into attendance (id, class_id, student_id, date, status, note, created_at)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date - 1, 'present', 'Đúng giờ', now()),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', current_date - 1, 'late', 'Muộn 10 phút', now()),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', current_date - 1, 'excused', 'Có phép', now()),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', current_date - 1, 'absent', 'Vắng không phép', now())
on conflict (id) do update set
  status = excluded.status,
  note = excluded.note;

insert into rewards (id, class_id, student_id, type, title, points, created_at)
values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'points', 'Đạt thành tích tuần', 25, now()),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'badge', 'Mũi nhọn hoạt động nhóm', 15, now())
on conflict (id) do update set
  title = excluded.title,
  points = excluded.points;

insert into assignments (id, class_id, title, description, due_date, status, created_at)
values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Bài tập Hóa học', 'Nộp chuyên cần và bài làm của chương 5', current_date + 3, 'review', now()),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Bản đồ tư duy Toán', 'Tạo sơ đồ tư duy theo chủ đề số nguyên', current_date + 5, 'todo', now())
on conflict (id) do update set
  description = excluded.description,
  due_date = excluded.due_date,
  status = excluded.status;

insert into assessments (id, class_id, student_id, title, score, date, created_at)
values
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Kiểm tra 15 phút', 9.5, current_date - 3, now()),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Bài tập cá nhân', 6.2, current_date - 2, now())
on conflict (id) do update set
  title = excluded.title,
  score = excluded.score,
  date = excluded.date;

select 'seed complete' as result;
