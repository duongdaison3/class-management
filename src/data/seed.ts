import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import type { Assessment, Assignment, AttendanceRecord, ClassRoom, Reward, School, Student } from '../types'

export async function ensureDemoData() {
  const schoolCount = await db.schools.count()

  if (schoolCount > 0) {
    return
  }

  const schoolId = uuidv4()
  const classId = uuidv4()
  const studentIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4()]

  const school: School = {
    id: schoolId,
    name: 'Trường THCS Hoàng Sa',
    address: 'Quận 7, TP.HCM',
    ownerId: 'teacher-001',
    createdAt: new Date().toISOString(),
  }

  const classRoom: ClassRoom = {
    id: classId,
    schoolId,
    name: '9A',
    teacherName: 'Nguyễn Thị Lan',
    room: 'Phòng 304',
    status: 'active',
    createdAt: new Date().toISOString(),
  }

  const students: Student[] = [
    {
      id: studentIds[0],
      classId,
      fullName: 'Nguyễn Minh An',
      phone: '0901234567',
      status: 'active',
      note: 'Học sinh tích cực, tham gia đầy đủ',
      createdAt: new Date().toISOString(),
    },
    {
      id: studentIds[1],
      classId,
      fullName: 'Trần Bảo Bình',
      phone: '0907654321',
      status: 'at-risk',
      note: 'Cần nhắc nhở về chuyên cần',
      createdAt: new Date().toISOString(),
    },
    {
      id: studentIds[2],
      classId,
      fullName: 'Lê Gia Hân',
      phone: '0912345678',
      status: 'active',
      note: 'Nhiệt tình trong hoạt động nhóm',
      createdAt: new Date().toISOString(),
    },
    {
      id: studentIds[3],
      classId,
      fullName: 'Phạm Quốc Khang',
      phone: '0923456789',
      status: 'inactive',
      note: 'Thiếu bài tập gần đây',
      createdAt: new Date().toISOString(),
    },
  ]

  const attendance: AttendanceRecord[] = [
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[0],
      date: '2026-10-12',
      status: 'present',
      note: 'Đúng giờ',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[1],
      date: '2026-10-12',
      status: 'late',
      note: 'Muộn 10 phút',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[2],
      date: '2026-10-12',
      status: 'excused',
      note: 'Có phép',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[3],
      date: '2026-10-12',
      status: 'absent',
      note: 'Vắng không phép',
      createdAt: new Date().toISOString(),
    },
  ]

  const rewards: Reward[] = [
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[0],
      type: 'points',
      title: 'Đạt thành tích tuần',
      points: 25,
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[2],
      type: 'badge',
      title: 'Mũi nhọn hoạt động nhóm',
      points: 15,
      createdAt: new Date().toISOString(),
    },
  ]

  const assignments: Assignment[] = [
    {
      id: uuidv4(),
      classId,
      title: 'Bài tập Hóa học',
      description: 'Nộp chuyên cần và bài làm của chương 5',
      dueDate: '2026-10-16',
      status: 'review',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      classId,
      title: 'Bản đồ tư duy Toán',
      description: 'Tạo sơ đồ tư duy theo chủ đề số nguyên',
      dueDate: '2026-10-18',
      status: 'todo',
      createdAt: new Date().toISOString(),
    },
  ]

  const assessments: Assessment[] = [
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[0],
      title: 'Kiểm tra 15 phút',
      score: 9.5,
      date: '2026-10-10',
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      classId,
      studentId: studentIds[1],
      title: 'Bài tập cá nhân',
      score: 6.2,
      date: '2026-10-11',
      createdAt: new Date().toISOString(),
    },
  ]

  await db.transaction(
    'rw',
    db.schools,
    db.classes,
    db.students,
    db.attendance,
    db.rewards,
    async () => {
      await db.schools.add(school)
      await db.classes.add(classRoom)
      await db.students.bulkAdd(students)
      await db.attendance.bulkAdd(attendance)
      await db.rewards.bulkAdd(rewards)
    },
  )

  await db.transaction('rw', db.assignments, async () => {
    await db.assignments.bulkAdd(assignments)
  })

  await db.assessments.bulkAdd(assessments)
  await db.syncQueue.bulkAdd([
    {
      id: uuidv4(),
      entityType: 'student',
      entityId: studentIds[0],
      operationType: 'create',
      payload: { fullName: 'Nguyễn Minh An' },
      createdAt: new Date().toISOString(),
      status: 'synced',
      retryCount: 0,
    },
    {
      id: uuidv4(),
      entityType: 'attendance',
      entityId: attendance[0].id,
      operationType: 'create',
      payload: { status: 'present' },
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
    },
  ])
}
