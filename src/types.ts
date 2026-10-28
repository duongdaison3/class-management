export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'arts' | 'health'
export type RewardType = 'points' | 'badge' | 'certificate'
export type SyncStatus = 'pending' | 'synced' | 'failed'

export interface School {
  id: string
  name: string
  address: string
  ownerId: string
  createdAt: string
}

export interface StudentGroup {
  id: string
  classId: string
  name: string
  studentIds: string[]
  createdAt: string
}

export interface ClassRoom {
  id: string
  schoolId: string
  name: string
  teacherName: string
  room: string
  status: 'active' | 'archived'
  createdAt: string
}

export interface Student {
  id: string
  classId: string
  fullName: string
  phone: string
  status: 'active' | 'at-risk' | 'inactive'
  note: string
  createdAt: string
}

export interface AttendanceRecord {
  id: string
  classId: string
  studentId: string
  date: string
  status: AttendanceStatus
  note: string
  createdAt: string
}

export interface Reward {
  id: string
  classId: string
  studentId: string
  type: RewardType
  title: string
  points: number
  createdAt: string
}

export interface Assignment {
  id: string
  classId: string
  title: string
  description: string
  dueDate: string
  status: 'todo' | 'review' | 'done'
  createdAt: string
}

export interface Assessment {
  id: string
  classId: string
  studentId: string
  title: string
  score: number
  date: string
  createdAt: string
}

export interface SyncQueueItem {
  id: string
  entityType: 'school' | 'student' | 'attendance' | 'reward' | 'assessment' | 'assignment' | 'class' | 'group'
  entityId: string
  operationType: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdAt: string
  status: SyncStatus
  retryCount: number
  lastAttemptedAt?: string
  nextRetryAt?: string
  lastError?: string
}

export interface AppSetting {
  id: string
  key: string
  value: string | number | boolean
  updatedAt: string
}

export const attendanceLabels: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  late: 'Đi muộn',
  absent: 'Vắng mặt',
  excused: 'Nghỉ có phép',
  arts: 'Văn nghệ',
  health: 'Y tế',
}
