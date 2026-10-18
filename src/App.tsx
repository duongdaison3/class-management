import { zodResolver } from '@hookform/resolvers/zod'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  BookMarked,
  BookOpenText,
  Building2,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  CloudSun,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { z } from 'zod'
import type { Session } from '@supabase/supabase-js'
import { ensureDemoData } from './data/seed'
import { db, hydrateFromSupabase, queueSyncOperation, syncPendingQueue } from './lib/db'
import { supabase } from './lib/supabase'
import { attendanceLabels, type Assignment, type Assessment, type AttendanceStatus, type ClassRoom, type Reward, type School, type Student, type StudentGroup } from './types'

const studentSchema = z.object({
  fullName: z.string().min(2, 'Tên học sinh tối thiểu 2 ký tự'),
  phone: z.string().min(9, 'Số điện thoại cần hợp lệ'),
  classId: z.string().min(1, 'Vui lòng chọn lớp'),
  note: z.string(),
})

const schoolSchema = z.object({
  name: z.string().min(2, 'Tên trường tối thiểu 2 ký tự'),
  address: z.string().min(3, 'Địa chỉ tối thiểu 3 ký tự'),
})

const classSchema = z.object({
  name: z.string().min(2, 'Tên lớp tối thiểu 2 ký tự'),
  teacherName: z.string().min(2, 'Tên giáo viên tối thiểu 2 ký tự'),
  room: z.string().min(2, 'Phòng học không được để trống'),
})

const rewardSchema = z.object({
  studentId: z.string().min(1, 'Vui lòng chọn học sinh'),
  groupId: z.string(),
  title: z.string().min(2, 'Tên phần thưởng tối thiểu 2 ký tự'),
  type: z.enum(['points', 'badge', 'certificate']),
  points: z.number().min(-500, 'Điểm thưởng tối thiểu là -500').max(500, 'Điểm thưởng tối đa là 500'),
})

const assignmentSchema = z.object({
  title: z.string().min(2, 'Tên bài tập tối thiểu 2 ký tự'),
  description: z.string().min(5, 'Mô tả cần có ít nhất 5 ký tự'),
  dueDate: z.string().min(1, 'Vui lòng chọn hạn nộp'),
  status: z.enum(['todo', 'review', 'done']),
})

const assessmentSchema = z.object({
  studentId: z.string().min(1, 'Vui lòng chọn học sinh'),
  title: z.string().min(2, 'Tên bài kiểm tra tối thiểu 2 ký tự'),
  score: z.number().min(0, 'Điểm không thể nhỏ hơn 0').max(10, 'Điểm không thể lớn hơn 10'),
  date: z.string().min(1, 'Vui lòng chọn ngày'),
})

type StudentFormValues = {
  fullName: string
  phone: string
  classId: string
  note: string
}

type SchoolFormValues = {
  name: string
  address: string
}

type ClassFormValues = {
  name: string
  teacherName: string
  room: string
}

type RewardFormValues = {
  studentId: string
  groupId: string
  title: string
  type: 'points' | 'badge' | 'certificate'
  points: number
}

type AssignmentFormValues = {
  title: string
  description: string
  dueDate: string
  status: 'todo' | 'review' | 'done'
}

type AssessmentFormValues = {
  studentId: string
  title: string
  score: number
  date: string
}

type AuthFormValues = {
  email: string
  password: string
}

const navItems = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/students', label: 'Học sinh', icon: Users },
  { to: '/attendance', label: 'Chuyên cần', icon: ListChecks },
  { to: '/classes', label: 'Lớp học', icon: BookMarked },
  { to: '/assignments', label: 'Bài tập / Ghi chú', icon: BookOpenText },
  { to: '/grading', label: 'Điểm số', icon: CheckCheck },
  { to: '/rewards', label: 'Điểm thưởng', icon: Trophy },
  { to: '/reports', label: 'Báo cáo', icon: ListChecks },
  { to: '/sync', label: 'Đồng bộ', icon: CloudSun },
]

const parseBulkStudentNames = (rawText: string) => {
  const cleaned = rawText
    .replace(/\r/g, '\n')
    .split(/\n|,|;|\t/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const normalized = value
        .replace(/\s+/g, ' ')
        .replace(/^[-•*\d\.)\]]+\s*/, '')
        .trim()
      return normalized
    })
    .filter(Boolean)

  return [...new Map(cleaned.map((name) => [name.toLowerCase(), name])).values()]
}

type RewardPresetKind = 'positive' | 'negative'

type RewardPreset = {
  id: string
  label: string
  points: number
  kind: RewardPresetKind
}

const rewardPresetStorageKey = 'reward-presets-v1'

const defaultRewardPresets: RewardPreset[] = [
  { id: 'positive-1', label: 'Chủ động', points: 1, kind: 'positive' },
  { id: 'positive-2', label: 'Tập trung', points: 1, kind: 'positive' },
  { id: 'positive-3', label: 'Có tinh thần', points: 2, kind: 'positive' },
  { id: 'positive-4', label: 'Hoàn thành tốt', points: 3, kind: 'positive' },
  { id: 'negative-1', label: 'Chưa cố gắng', points: -1, kind: 'negative' },
  { id: 'negative-2', label: 'Không chú ý', points: -1, kind: 'negative' },
  { id: 'negative-3', label: 'Không đúng giờ', points: -2, kind: 'negative' },
  { id: 'negative-4', label: 'Học sai quy tắc', points: -2, kind: 'negative' },
]

const formatRewardPoints = (points: number) => {
  if (points >= 0) return `+${points}`
  return `${points}`
}

function App() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [remoteHydrated, setRemoteHydrated] = useState(!supabase)
  const [authError, setAuthError] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let mounted = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return
      }

      if (error) {
        setAuthError(error.message)
      }

      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthError('')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      void ensureDemoData()
    }

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      return
    }

    let mounted = true
    void hydrateFromSupabase()
      .then(() => {
        if (mounted) {
          setRemoteHydrated(true)
        }
      })
      .catch((error) => {
        console.error('Không thể tải dữ liệu từ Supabase:', error)
        if (mounted) {
          setAuthError(error instanceof Error ? error.message : 'Không thể tải dữ liệu từ Supabase')
          setRemoteHydrated(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [session])

  useEffect(() => {
    if (!isOnline || !supabase || !session || !remoteHydrated) {
      return
    }

    void syncPendingQueue()
  }, [isOnline, remoteHydrated, session])

  const schools = useLiveQuery(() => db.schools.orderBy('name').toArray(), []) ?? []
  const classes = useLiveQuery(() => db.classes.orderBy('name').toArray(), []) ?? []
  const groups = useLiveQuery(() => db.groups.orderBy('name').toArray(), []) ?? []
  const students = useLiveQuery(() => db.students.orderBy('fullName').toArray(), []) ?? []
  const attendance = useLiveQuery(() => db.attendance.orderBy('date').reverse().toArray(), []) ?? []
  const rewards = useLiveQuery(() => db.rewards.orderBy('createdAt').reverse().toArray(), []) ?? []
  const assignments = useLiveQuery(() => db.assignments.orderBy('dueDate').toArray(), []) ?? []
  const assessments = useLiveQuery(() => db.assessments.orderBy('date').reverse().toArray(), []) ?? []
  const syncQueue = useLiveQuery(() => db.syncQueue.orderBy('createdAt').reverse().toArray(), []) ?? []

  const effectiveSchoolId = selectedSchoolId || schools[0]?.id || ''
  const schoolClasses = classes.filter((item) => item.schoolId === effectiveSchoolId)
  const effectiveClassId = selectedClassId || schoolClasses[0]?.id || ''
  const activeClass = classes.find((item) => item.id === effectiveClassId) ?? schoolClasses[0]
  const scopedStudents = students.filter((item) => item.classId === effectiveClassId)
  const scopedAttendance = attendance.filter((item) => item.classId === effectiveClassId)
  const scopedRewards = rewards.filter((item) => item.classId === effectiveClassId)
  const scopedAssessments = assessments.filter((item) => item.classId === effectiveClassId)
  const scopedAssignments = assignments.filter((item) => item.classId === effectiveClassId)
  const totalPoints = scopedRewards.reduce((sum, item) => sum + item.points, 0)

  const schoolName = schools.find((item) => item.id === effectiveSchoolId)?.name ?? 'Classroom Hub'

  useEffect(() => {
    if (!selectedSchoolId && schools[0]?.id) setSelectedSchoolId(schools[0].id)
    if (selectedSchoolId && !schools.some((school) => school.id === selectedSchoolId)) {
      setSelectedSchoolId(schools[0]?.id ?? '')
    }
    if (!selectedClassId && schoolClasses[0]?.id) setSelectedClassId(schoolClasses[0].id)
    if (selectedClassId && !schoolClasses.some((item) => item.id === selectedClassId)) {
      setSelectedClassId(schoolClasses[0]?.id ?? '')
    }
  }, [schoolClasses, schools, selectedClassId, selectedSchoolId])

  const handleAddSchool = async (values: SchoolFormValues) => {
    const school = {
      id: crypto.randomUUID(),
      ownerId: session?.user.id ?? 'local-teacher',
      name: values.name,
      address: values.address,
      createdAt: new Date().toISOString(),
    }
    await db.schools.add(school)
    await queueSyncOperation('school', school.id, 'create', school)
    setSelectedSchoolId(school.id)
  }

  const handleUpdateSchool = async (school: School, values: SchoolFormValues) => {
    const updated = { ...school, ...values }
    await db.schools.put(updated)
    await queueSyncOperation('school', updated.id, 'update', updated)
  }

  const handleDeleteSchool = async (school: School) => {
    if (!window.confirm(`Xóa trường "${school.name}" và dữ liệu liên quan?`)) return
    await db.schools.delete(school.id)
    await queueSyncOperation('school', school.id, 'delete', {})
    if (selectedSchoolId === school.id) setSelectedSchoolId('')
  }

  const handleAddStudent = async (values: StudentFormValues) => {
    const student = {
      id: crypto.randomUUID(),
      classId: values.classId,
      fullName: values.fullName,
      phone: values.phone,
      status: 'active' as const,
      note: values.note,
      createdAt: new Date().toISOString(),
    }

    await db.students.add(student)
    await queueSyncOperation('student', student.id, 'create', student)
  }

  const handleUpdateStudent = async (student: Student, values: StudentFormValues) => {
    const updated = { ...student, ...values }
    await db.students.put(updated)
    await queueSyncOperation('student', updated.id, 'update', updated)
  }

  const handleDeleteStudents = async (studentIds: string[]) => {
    if (studentIds.length === 0 || !window.confirm(`Xóa ${studentIds.length} học sinh đã chọn?`)) return
    const selected = students.filter((student) => studentIds.includes(student.id))
    await db.students.bulkDelete(studentIds)
    await Promise.all(selected.map((student) => queueSyncOperation('student', student.id, 'delete', {})))
  }

  const handleAddClass = async (values: ClassFormValues) => {
    const classRoom = {
      id: crypto.randomUUID(),
      schoolId: effectiveSchoolId,
      name: values.name,
      teacherName: values.teacherName,
      room: values.room,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    }

    await db.classes.add(classRoom)
    await queueSyncOperation('class', classRoom.id, 'create', classRoom)
  }

  const handleUpdateClass = async (classRoom: ClassRoom, values: ClassFormValues) => {
    const updated = { ...classRoom, ...values }
    await db.classes.put(updated)
    await queueSyncOperation('class', updated.id, 'update', updated)
  }

  const handleDeleteClass = async (classRoom: ClassRoom) => {
    if (!window.confirm(`Xóa lớp "${classRoom.name}"? Dữ liệu lớp sẽ không còn trên máy này.`)) return
    await db.classes.delete(classRoom.id)
    await queueSyncOperation('class', classRoom.id, 'delete', {})
    if (selectedClassId === classRoom.id) setSelectedClassId('')
  }

  const handleAddReward = async (values: RewardFormValues) => {
    const group = groups.find((item) => item.id === values.groupId)
    const studentIds = group?.studentIds ?? [values.studentId]
    await Promise.all(studentIds.map(async (studentId) => {
      const reward = {
        id: crypto.randomUUID(),
        classId: activeClass?.id ?? '',
        studentId,
        type: values.type,
        title: values.title,
        points: values.points,
        createdAt: new Date().toISOString(),
      }
      await db.rewards.add(reward)
      await queueSyncOperation('reward', reward.id, 'create', reward)
    }))
  }

  const handleCreateAssignment = async (values: AssignmentFormValues) => {
    const assignment = {
      id: crypto.randomUUID(),
      classId: activeClass?.id ?? '',
      title: values.title,
      description: values.description,
      dueDate: values.dueDate,
      status: values.status,
      createdAt: new Date().toISOString(),
    }

    await db.assignments.add(assignment)
    await queueSyncOperation('assignment', assignment.id, 'create', assignment)
  }

  const handleCreateAssessment = async (values: AssessmentFormValues) => {
    const assessment = {
      id: crypto.randomUUID(),
      classId: activeClass?.id ?? '',
      studentId: values.studentId,
      title: values.title,
      score: values.score,
      date: values.date ?? new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    }

    await db.assessments.add(assessment)
    await queueSyncOperation('assessment', assessment.id, 'create', assessment)
  }

  const handleUpdateAssessment = async (assessment: Assessment, values: AssessmentFormValues) => {
    const updated = { ...assessment, ...values }
    await db.assessments.put(updated)
    await queueSyncOperation('assessment', updated.id, 'update', updated)
  }

  const handleDeleteAssessment = async (assessment: Assessment) => {
    await db.assessments.delete(assessment.id)
    await queueSyncOperation('assessment', assessment.id, 'delete', {})
  }

  const handleMarkAttendance = async (studentId: string, status: AttendanceStatus) => {
    const record = {
      id: crypto.randomUUID(),
      classId: effectiveClassId,
      studentId,
      date: new Date().toISOString().slice(0, 10),
      status,
      note: `Đánh dấu ${attendanceLabels[status].toLowerCase()}`,
      createdAt: new Date().toISOString(),
    }

    await db.attendance.add(record)
    await queueSyncOperation('attendance', record.id, 'create', record)
  }

  const handleBulkAttendance = async (studentIds: string[], status: AttendanceStatus, date: string) => {
    await Promise.all(studentIds.map(async (studentId) => {
      const existing = attendance.find((item) => item.studentId === studentId && item.date === date && item.classId === effectiveClassId)
      const record = {
        id: existing?.id ?? crypto.randomUUID(),
        classId: effectiveClassId,
        studentId,
        date,
        status,
        note: `Đánh dấu ${attendanceLabels[status].toLowerCase()}`,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
      if (existing) await db.attendance.put(record)
      else await db.attendance.add(record)
      await queueSyncOperation('attendance', record.id, existing ? 'update' : 'create', record)
    }))
  }

  const handleCreateGroup = async (name: string, studentIds: string[]) => {
    const group: StudentGroup = {
      id: crypto.randomUUID(),
      classId: effectiveClassId,
      name,
      studentIds,
      createdAt: new Date().toISOString(),
    }
    await db.groups.add(group)
    await queueSyncOperation('group', group.id, 'create', { ...group })
  }

  const handleUpdateGroup = async (group: StudentGroup, name: string, studentIds: string[]) => {
    const updated = { ...group, name, studentIds }
    await db.groups.put(updated)
    await queueSyncOperation('group', updated.id, 'update', updated)
  }

  const handleDeleteGroup = async (group: StudentGroup) => {
    if (!window.confirm(`Xóa nhóm "${group.name}"?`)) return
    await db.groups.delete(group.id)
    await queueSyncOperation('group', group.id, 'delete', {})
  }

  const handleUpdateAssignment = async (assignment: Assignment, values: AssignmentFormValues) => {
    const updated = { ...assignment, ...values }
    await db.assignments.put(updated)
    await queueSyncOperation('assignment', updated.id, 'update', updated)
  }

  const handleDeleteAssignment = async (assignment: Assignment) => {
    await db.assignments.delete(assignment.id)
    await queueSyncOperation('assignment', assignment.id, 'delete', {})
  }

  const handleUpdateReward = async (reward: Reward, values: Pick<Reward, 'title' | 'points' | 'type'>) => {
    const updated = { ...reward, ...values }
    await db.rewards.put(updated)
    await queueSyncOperation('reward', updated.id, 'update', updated)
  }

  const handleDeleteReward = async (reward: Reward) => {
    await db.rewards.delete(reward.id)
    await queueSyncOperation('reward', reward.id, 'delete', {})
  }

  const handleSyncNow = async () => {
    if (!isOnline) {
      return
    }

    await syncPendingQueue()
  }

  const handleSignOut = async () => {
    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthError(error.message)
    }
  }

  if (authLoading) {
    return <LoadingScreen />
  }

  if (supabase && !session) {
    return <LoginPage error={authError} onError={setAuthError} />
  }

  return (
    <BrowserRouter>
      <div className="app-shell min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-[1600px]">
          <aside className="glass-sidebar hidden w-72 shrink-0 md:flex md:flex-col">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 shadow-[0_18px_45px_rgba(14,165,233,0.35)]">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Classroom</p>
                  <h2 className="text-xl font-semibold text-white">Hub</h2>
                </div>
              </div>
            </div>

            <nav className="flex flex-col gap-2 p-4">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-cyan-400/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto space-y-4 border-t border-white/10 p-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Trường</p>
                <select
                  value={effectiveSchoolId}
                  onChange={(event) => setSelectedSchoolId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-2.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                  aria-label="Chọn trường"
                >
                  {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Đăng nhập Supabase</span>
                  <span className={`inline-flex items-center gap-1 ${supabase ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {supabase ? <ShieldCheck className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
                    {supabase ? 'Sẵn sàng' : 'Mẫu'}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <header className="glass-header sticky top-0 z-20">
              <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-slate-400">Hệ thống quản lý lớp học</p>
                  <h1 className="mt-1 text-2xl font-semibold text-white">{schoolName}</h1>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      isOnline
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    }`}
                  >
                    {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    {isOnline ? 'Online' : 'Offline'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    {session && (
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
                      >
                        Đăng xuất
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-slate-950/30 px-4 py-3 md:px-8">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">Lớp đang chọn</span>
                    <div className="flex flex-wrap gap-2">
                      {schoolClasses.length === 0 ? (
                        <span className="rounded-full border border-dashed border-slate-700 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-400">
                          Chưa có lớp trong trường
                        </span>
                      ) : (
                        schoolClasses.map((classItem) => (
                          <button
                            key={classItem.id}
                            type="button"
                            onClick={() => setSelectedClassId(classItem.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                              effectiveClassId === classItem.id
                                ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                                : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:text-white'
                            }`}
                            aria-label={`Chuyển sang lớp ${classItem.name}`}
                          >
                            {classItem.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <label className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">Trường</label>
                    <select
                      value={effectiveSchoolId}
                      onChange={(event) => setSelectedSchoolId(event.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-2.5 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                      aria-label="Chọn trường"
                    >
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </header>

            <main className="p-4 md:p-8">
              <Routes>
                <Route
                  path="/"
                  element={
                    <DashboardPage
                      students={scopedStudents}
                      classes={schoolClasses}
                      assignments={scopedAssignments}
                      attendance={scopedAttendance}
                      rewards={scopedRewards}
                      assessments={scopedAssessments}
                      syncQueue={syncQueue}
                      isOnline={isOnline}
                      onSyncNow={handleSyncNow}
                      schools={schools}
                      selectedSchoolId={effectiveSchoolId}
                      onSelectSchool={setSelectedSchoolId}
                      onAddSchool={handleAddSchool}
                      onUpdateSchool={handleUpdateSchool}
                      onDeleteSchool={handleDeleteSchool}
                      selectedClassId={effectiveClassId}
                      onSelectClass={setSelectedClassId}
                    />
                  }
                />
                <Route
                  path="/students"
                  element={
                    <StudentsPage
                      classes={schoolClasses}
                      students={scopedStudents}
                      onAddStudent={handleAddStudent}
                      onUpdateStudent={handleUpdateStudent}
                      onDeleteStudents={handleDeleteStudents}
                    />
                  }
                />
                <Route
                  path="/attendance"
                  element={<AttendancePage students={scopedStudents} attendance={scopedAttendance} onMarkAttendance={handleMarkAttendance} onBulkAttendance={handleBulkAttendance} />}
                />
                <Route
                  path="/classes"
                  element={<ClassesPage classes={schoolClasses} students={scopedStudents} groups={groups.filter((item) => item.classId === effectiveClassId)} onAddClass={handleAddClass} onUpdateClass={handleUpdateClass} onDeleteClass={handleDeleteClass} onCreateGroup={handleCreateGroup} onUpdateGroup={handleUpdateGroup} onDeleteGroup={handleDeleteGroup} />}
                />
                <Route
                  path="/assignments"
                  element={<AssignmentsPage assignments={scopedAssignments} onCreateAssignment={handleCreateAssignment} onUpdateAssignment={handleUpdateAssignment} onDeleteAssignment={handleDeleteAssignment} />}
                />
                <Route
                  path="/grading"
                  element={<GradingPage students={scopedStudents} assessments={scopedAssessments} onCreateAssessment={handleCreateAssessment} onUpdateAssessment={handleUpdateAssessment} onDeleteAssessment={handleDeleteAssessment} />}
                />
                <Route
                  path="/rewards"
                  element={<RewardsPage students={scopedStudents} rewards={scopedRewards} totalPoints={totalPoints} onAddReward={handleAddReward} onUpdateReward={handleUpdateReward} onDeleteReward={handleDeleteReward} groups={groups.filter((item) => item.classId === effectiveClassId)} />}
                />
                <Route
                  path="/reports"
                  element={<ReportsPage students={scopedStudents} classes={schoolClasses} attendance={scopedAttendance} rewards={scopedRewards} assessments={scopedAssessments} assignments={scopedAssignments} syncQueue={syncQueue} />}
                />
                <Route
                  path="/sync"
                  element={<SyncPage syncQueue={syncQueue} onSyncNow={handleSyncNow} isOnline={isOnline} />}
                />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </BrowserRouter>
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
      <div className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">Đang kiểm tra phiên đăng nhập</h1>
        <p className="mt-2 text-sm text-slate-400">Classroom Hub đang kết nối tới Supabase.</p>
      </div>
    </div>
  )
}

function LoginPage({
  error,
  onError,
}: {
  error: string
  onError: (message: string) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<AuthFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 shadow-lg shadow-cyan-500/20">
            <GraduationCap className="h-7 w-7" />
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.2em] text-cyan-300">Classroom Hub</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Đăng nhập quản lý lớp</h1>
          <p className="mt-2 text-sm text-slate-400">Dữ liệu cloud được bảo vệ bằng Supabase Auth.</p>
        </div>

        <form
          className="panel space-y-5 p-6"
          onSubmit={form.handleSubmit(async (values) => {
            if (!supabase) {
              onError('Supabase chưa được cấu hình.')
              return
            }

            setIsSubmitting(true)
            onError('')
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: values.email,
              password: values.password,
            })
            setIsSubmitting(false)

            if (signInError) {
              onError(signInError.message)
            }
          })}
        >
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              autoComplete="email"
              {...form.register('email', { required: 'Vui lòng nhập email' })}
              className="input-shell"
              placeholder="teacher@example.com"
            />
            {form.formState.errors.email && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Mật khẩu</label>
            <input
              type="password"
              autoComplete="current-password"
              {...form.register('password', { required: 'Vui lòng nhập mật khẩu' })}
              className="input-shell"
              placeholder="Nhập mật khẩu Supabase"
            />
            {form.formState.errors.password && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.password.message}</p>}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}

function DashboardPage({
  students,
  classes,
  assignments,
  attendance,
  rewards,
  assessments,
  syncQueue,
  isOnline,
  onSyncNow,
  schools,
  selectedSchoolId,
  onSelectSchool,
  onAddSchool,
  onUpdateSchool,
  onDeleteSchool,
  selectedClassId,
  onSelectClass,
}: {
  students: Array<{ fullName: string; status: string }>
  classes: Array<{ id: string; name: string }>
  assignments: Array<{ status: string; title: string; dueDate: string }>
  attendance: Array<{ date: string; status: string }>
  rewards: Array<{ points: number }>
  assessments: Array<{ score: number }>
  syncQueue: Array<{ status: string }>
  isOnline: boolean
  onSyncNow: () => Promise<void>
  schools: School[]
  selectedSchoolId: string
  onSelectSchool: (id: string) => void
  onAddSchool: (values: SchoolFormValues) => Promise<void>
  onUpdateSchool: (school: School, values: SchoolFormValues) => Promise<void>
  onDeleteSchool: (school: School) => Promise<void>
  selectedClassId: string
  onSelectClass: (id: string) => void
}) {
  const schoolForm = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: { name: '', address: '' },
  })
  const studentAtRisk = students.filter((student) => student.status === 'at-risk').length
  const presentCount = attendance.filter((item) => item.status === 'present').length
  const dueSoon = assignments.filter((assignment) => assignment.status !== 'done').length
  const averageScore =
    assessments.length > 0 ? assessments.reduce((sum, item) => sum + item.score, 0) / assessments.length : 0
  const totalPoints = rewards.reduce((sum, item) => sum + item.points, 0)
  const pendingSync = syncQueue.filter((item) => item.status === 'pending').length
  const syncedCount = syncQueue.filter((item) => item.status === 'synced').length
  const syncStatusText = isOnline ? 'Đã kết nối • Đồng bộ tự động' : 'Chờ mạng • sẽ đồng bộ khi có internet'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="chip-pill text-cyan-200">Tổng quan</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Bảng điều khiển lớp học</h2>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${isOnline ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {syncStatusText}
          </span>
          <button
            type="button"
            onClick={() => void onSyncNow()}
            className="soft-primary"
          >
            <CloudSun className="h-4 w-4" />
            {isOnline ? 'Đồng bộ ngay' : 'Lưu trên thiết bị'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_360px]">
        <div className="panel p-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300"><Building2 className="h-4 w-4 text-cyan-300" />Trường đang chọn</label>
          <select value={selectedSchoolId} onChange={(event) => onSelectSchool(event.target.value)} className="input-shell">
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
          <p className="mt-2 text-xs text-slate-500">{schools.find((school) => school.id === selectedSchoolId)?.address}</p>
          {schools.find((school) => school.id === selectedSchoolId) && (
            <div className="mt-3 flex gap-2">
              <button type="button" className="soft-secondary flex-1" onClick={() => {
                const school = schools.find((item) => item.id === selectedSchoolId)
                if (!school) return
                const name = window.prompt('Tên trường', school.name)
                const address = window.prompt('Địa chỉ', school.address)
                if (name?.trim() && address?.trim()) void onUpdateSchool(school, { name: name.trim(), address: address.trim() })
              }}>Sửa</button>
              <button type="button" className="rounded-xl border border-rose-500/30 px-3 py-2 text-sm text-rose-200" onClick={() => {
                const school = schools.find((item) => item.id === selectedSchoolId)
                if (school) void onDeleteSchool(school)
              }}>Xóa</button>
            </div>
          )}
        </div>
        <div className="panel p-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300"><BookMarked className="h-4 w-4 text-violet-300" />Lớp đang xem</label>
          <select value={selectedClassId} onChange={(event) => onSelectClass(event.target.value)} className="input-shell">
            {classes.map((classItem) => <option key={classItem.id} value={classItem.id}>{classItem.name}</option>)}
          </select>
          <p className="mt-2 text-xs text-slate-500">Sĩ số: {students.length} học sinh</p>
        </div>
        <form className="panel p-4" onSubmit={schoolForm.handleSubmit(async (values) => { await onAddSchool(values); schoolForm.reset() })}>
          <p className="mb-3 text-sm font-medium text-slate-300">Thêm trường</p>
          <input {...schoolForm.register('name')} className="input-shell mb-2" placeholder="Tên trường" />
          <input {...schoolForm.register('address')} className="input-shell mb-3" placeholder="Địa chỉ" />
          <button className="soft-secondary w-full">Tạo trường</button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Tổng học sinh" value={String(students.length)} tone="cyan" />
        <MetricCard icon={<BookMarked className="h-5 w-5" />} label="Lớp đang mở" value={String(classes.length)} tone="violet" />
        <MetricCard icon={<CheckCheck className="h-5 w-5" />} label="Có mặt hôm nay" value={String(presentCount)} tone="emerald" />
        <MetricCard icon={<Trophy className="h-5 w-5" />} label="Điểm thưởng" value={`${totalPoints}`} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Hiệu suất tuần</h3>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
              Trung bình {averageScore.toFixed(1)}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <ProgressRow label="Chuyên cần" value={Math.min(100, (presentCount / Math.max(students.length, 1)) * 100)} color="bg-emerald-500" />
            <ProgressRow label="Bài tập" value={Math.min(100, (assignments.length > 0 ? 72 : 0))} color="bg-cyan-500" />
            <ProgressRow label="Tích cực" value={Math.min(100, (totalPoints / 150) * 100)} color="bg-violet-500" />
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-lg font-semibold text-white">Cần chú ý</h3>

          <div className="mt-5 space-y-3">
            <MiniStat label="Học sinh cần hỗ trợ" value={String(studentAtRisk)} accent="amber" />
            <MiniStat label="Nhiệm vụ đang chờ" value={String(dueSoon)} accent="cyan" />
            <MiniStat label="Đang chờ đồng bộ" value={String(pendingSync)} accent="violet" />
            <MiniStat label="Đã đồng bộ" value={String(syncedCount)} accent="emerald" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Nhiệm vụ sắp tới</h3>
            <BookOpenText className="h-5 w-5 text-cyan-300" />
          </div>

          <div className="mt-5 space-y-3">
            {assignments.slice(0, 3).map((assignment) => (
              <div key={assignment.title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{assignment.title}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    {assignment.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">Hạn nộp: {assignment.dueDate}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Bản cập nhật đồng bộ</h3>
            {isOnline ? <Wifi className="h-5 w-5 text-emerald-300" /> : <WifiOff className="h-5 w-5 text-amber-300" />}
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span>Trạng thái mạng</span>
              <span className={isOnline ? 'text-emerald-400' : 'text-amber-400'}>{isOnline ? 'Kết nối bình thường' : 'Đang offline'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span>Supabase</span>
              <span className={supabase ? 'text-emerald-400' : 'text-amber-400'}>{supabase ? 'Giám sát hoạt động' : 'Chế độ mẫu'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span>Hàng đợi</span>
              <span className="text-cyan-300">{pendingSync} mục đang chờ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentsPage({
  classes,
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudents,
}: {
  classes: Array<{ id: string; name: string }>
  students: Array<{ id: string; fullName: string; phone: string; status: string; note: string; classId: string }>
  onAddStudent: (values: StudentFormValues) => Promise<void>
  onUpdateStudent: (student: Student, values: StudentFormValues) => Promise<void>
  onDeleteStudents: (studentIds: string[]) => Promise<void>
}) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      classId: classes[0]?.id ?? '',
      note: '',
    },
  })
  const [bulkText, setBulkText] = useState('')
  const [bulkPreview, setBulkPreview] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (classes[0]?.id) {
      form.setValue('classId', classes[0].id)
    }
  }, [classes, form])

  const handleBulkPreview = () => {
    const nextNames = parseBulkStudentNames(bulkText)
    setBulkPreview(nextNames)
  }

  const handleBulkInsert = async () => {
    const targetClassId = form.getValues('classId') || classes[0]?.id || ''
    const names = parseBulkStudentNames(bulkText)
    if (!targetClassId || names.length === 0) {
      return
    }

    for (const fullName of names) {
      await onAddStudent({
        fullName,
        phone: '',
        classId: targetClassId,
        note: 'Nhập hàng loạt từ danh sách',
      })
    }

    setBulkText('')
    setBulkPreview([])
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="panel p-6">
        <h3 className="text-xl font-semibold text-white">Thêm học sinh</h3>
        <p className="mt-1 text-sm text-slate-400">Dữ liệu được lưu cục bộ trước và đưa vào hàng đợi đồng bộ.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onAddStudent(values)
            form.reset({
              fullName: '',
              phone: '',
              classId: classes[0]?.id ?? '',
              note: '',
            })
          })}
        >
          <div>
            <label className="mb-2 block text-sm text-slate-300">Họ và tên</label>
            <input {...form.register('fullName')} className="input-shell" placeholder="Ví dụ: Nguyễn Minh An" />
            {form.formState.errors.fullName && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.fullName.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Số điện thoại</label>
            <input {...form.register('phone')} className="input-shell" placeholder="0901234567" />
            {form.formState.errors.phone && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.phone.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Lớp học</label>
            <select {...form.register('classId')} className="input-shell">
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Ghi chú</label>
            <textarea {...form.register('note')} className="input-shell min-h-24" placeholder="Tình trạng học tập, điểm mạnh, kèm cặp..." />
          </div>

          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400">
            <ArrowRight className="h-4 w-4" />
            Lưu học sinh
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-white">Nhập hàng loạt</h4>
              <p className="mt-1 text-xs text-slate-400">Dán tên học sinh từ Word/Excel; xem lại trước khi lưu.</p>
            </div>
            <button type="button" onClick={handleBulkPreview} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 hover:border-violet-300">
              Xem lại
            </button>
          </div>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            className="mt-3 min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500"
            placeholder="Nguyễn Minh An\nTrần Bảo Bình\nLê Gia Hân"
          />
          {bulkPreview.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Xem trước ({bulkPreview.length})</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {bulkPreview.map((name) => <li key={name} className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">{name}</li>)}
              </ul>
              <button type="button" onClick={() => void handleBulkInsert()} className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400">
                Nhập vào lớp đã chọn
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">Danh sách học sinh</h3>
            <div className="flex gap-2">
              <button type="button" className="soft-secondary" onClick={() => setSelectedIds(students.map((student) => student.id))}>Chọn tất cả</button>
              <button type="button" className="rounded-xl border border-rose-500/30 px-3 py-2 text-sm text-rose-200 disabled:opacity-40" disabled={!selectedIds.length} onClick={() => void onDeleteStudents(selectedIds)}>Xóa {selectedIds.length || ''}</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-6 py-3"><input type="checkbox" checked={students.length > 0 && selectedIds.length === students.length} onChange={(event) => setSelectedIds(event.target.checked ? students.map((student) => student.id) : [])} aria-label="Chọn tất cả học sinh" /></th>
                <th className="px-6 py-3 font-medium">Học sinh</th>
                <th className="px-6 py-3 font-medium">Điện thoại</th>
                <th className="px-6 py-3 font-medium">Trạng thái</th>
                <th className="px-6 py-3 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-slate-800/80 bg-slate-900/30">
                  <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} aria-label={`Chọn ${student.fullName}`} /></td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{student.fullName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{student.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(student.status)}`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{student.note || 'Chưa có ghi chú'}</td>
                  <td className="px-6 py-4">
                    <button type="button" className="text-cyan-300 hover:text-cyan-200" onClick={() => {
                      const fullName = window.prompt('Họ và tên', student.fullName)
                      const phone = window.prompt('Số điện thoại', student.phone)
                      const note = window.prompt('Ghi chú', student.note)
                      if (fullName?.trim() && phone !== null && note !== null) void onUpdateStudent(student as Student, { fullName: fullName.trim(), phone, note, classId: student.classId })
                    }}>Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AttendancePage({
  students,
  attendance,
  onMarkAttendance,
  onBulkAttendance,
}: {
  students: Array<{ id: string; fullName: string }>
  attendance: Array<{ studentId: string; status: string; date: string }>
  onMarkAttendance: (studentId: string, status: AttendanceStatus) => Promise<void>
  onBulkAttendance: (studentIds: string[], status: AttendanceStatus, date: string) => Promise<void>
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [defaultStatus, setDefaultStatus] = useState<AttendanceStatus>('present')
  const dateRecords = attendance.filter((record) => record.date === date)
  const ids = selectedIds.length > 0 ? selectedIds : students.map((student) => student.id)

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Chuyên cần</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Theo dõi tham dự</h3>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-cyan-300" />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200" />
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-4">
          <button type="button" onClick={() => setSelectedIds(students.map((student) => student.id))} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400">Chọn tất cả</button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400">Bỏ chọn</button>
          <select value={defaultStatus} onChange={(event) => setDefaultStatus(event.target.value as AttendanceStatus)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
            {Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" onClick={() => void onBulkAttendance(ids, defaultStatus, date)} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400">Áp dụng cho {ids.length} học sinh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-6 py-3 font-medium">Chọn</th>
                <th className="px-6 py-3 font-medium">Học sinh</th>
                <th className="px-6 py-3 font-medium">Trạng thái hôm nay</th>
                <th className="px-6 py-3 font-medium">Chọn nhanh</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const latest = dateRecords.find((record) => record.studentId === student.id)

                return (
                  <tr key={student.id} className="border-b border-slate-800/80 bg-slate-900/30">
                    <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} aria-label={`Chọn ${student.fullName}`} /></td>
                    <td className="px-6 py-4 font-medium text-white">{student.fullName}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(latest?.status ?? 'absent')}`}>
                        {latest ? attendanceLabels[latest.status as AttendanceStatus] : 'Chưa ghi nhận'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(['present', 'late', 'absent', 'excused'] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-200"
                            onClick={() => void onMarkAttendance(student.id, status)}
                          >
                            {attendanceLabels[status]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ClassesPage({
  classes,
  students,
  groups,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: {
  classes: Array<{ id: string; name: string; teacherName: string; room: string; status: string }>
  students: Array<{ id: string; fullName: string; status: string }>
  groups: StudentGroup[]
  onAddClass: (values: ClassFormValues) => Promise<void>
  onUpdateClass: (classRoom: ClassRoom, values: ClassFormValues) => Promise<void>
  onDeleteClass: (classRoom: ClassRoom) => Promise<void>
  onCreateGroup: (name: string, studentIds: string[]) => Promise<void>
  onUpdateGroup: (group: StudentGroup, name: string, studentIds: string[]) => Promise<void>
  onDeleteGroup: (group: StudentGroup) => Promise<void>
}) {
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      teacherName: '',
      room: '',
    },
  })
  const [groupName, setGroupName] = useState('')
  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([])

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="panel p-6">
        <h3 className="text-xl font-semibold text-white">Tạo lớp học mới</h3>
        <form
          className="mt-5 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onAddClass(values)
            form.reset({
              name: '',
              teacherName: '',
              room: '',
            })
          })}
        >
          <div>
            <label className="mb-2 block text-sm text-slate-300">Tên lớp</label>
            <input {...form.register('name')} className="input-shell" placeholder="Ví dụ: 9A" />
            {form.formState.errors.name && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Giáo viên chủ nhiệm</label>
            <input {...form.register('teacherName')} className="input-shell" placeholder="Ví dụ: Nguyễn Thị Lan" />
            {form.formState.errors.teacherName && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.teacherName.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Phòng học</label>
            <input {...form.register('room')} className="input-shell" placeholder="Ví dụ: Phòng 304" />
            {form.formState.errors.room && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.room.message}</p>}
          </div>

          <button type="submit" className="w-full rounded-xl bg-violet-500 px-4 py-2.5 font-medium text-white transition hover:bg-violet-400">
            Lưu lớp học
          </button>
        </form>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-6">
          <h3 className="text-xl font-semibold text-white">Danh sách lớp</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-6 py-3 font-medium">Lớp</th>
                <th className="px-6 py-3 font-medium">Giáo viên</th>
                <th className="px-6 py-3 font-medium">Phòng</th>
                <th className="px-6 py-3 font-medium">Trạng thái</th>
                <th className="px-6 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classItem) => (
                <tr key={classItem.id} className="border-b border-slate-800/80 bg-slate-900/30">
                  <td className="px-6 py-4 font-medium text-white">{classItem.name}</td>
                  <td className="px-6 py-4 text-slate-300">{classItem.teacherName}</td>
                  <td className="px-6 py-4 text-slate-300">{classItem.room}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(classItem.status)}`}>
                      {classItem.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button type="button" className="mr-3 text-cyan-300" onClick={() => {
                      const name = window.prompt('Tên lớp', classItem.name)
                      const teacherName = window.prompt('Giáo viên', classItem.teacherName)
                      const room = window.prompt('Phòng học', classItem.room)
                      if (name?.trim() && teacherName?.trim() && room?.trim()) void onUpdateClass(classItem as ClassRoom, { name: name.trim(), teacherName: teacherName.trim(), room: room.trim() })
                    }}>Sửa</button>
                    <button type="button" className="text-rose-300" onClick={() => void onDeleteClass(classItem as ClassRoom)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel p-6 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">Nhóm học tập</h3>
            <p className="mt-1 text-sm text-slate-400">Chọn nhiều học sinh rồi tạo nhóm một lần.</p>
          </div>
          <div className="flex gap-2">
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="input-shell w-52" placeholder="Tên nhóm" />
            <button type="button" disabled={!groupName.trim() || groupStudentIds.length === 0} onClick={() => { void onCreateGroup(groupName.trim(), groupStudentIds); setGroupName(''); setGroupStudentIds([]) }} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40">Tạo nhóm</button>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {students.map((student) => <label key={student.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200"><input type="checkbox" checked={groupStudentIds.includes(student.id)} onChange={(event) => setGroupStudentIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} />{student.fullName}</label>)}
        </div>
        <div className="mt-5 space-y-2">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
              <span>{group.name} · {group.studentIds.length} HS</span>
              <span>
                <button type="button" className="mr-3 text-cyan-200" onClick={() => {
                  const name = window.prompt('Tên nhóm', group.name)
                  if (name?.trim()) void onUpdateGroup(group, name.trim(), group.studentIds)
                }}>Sửa</button>
                <button type="button" className="text-rose-200" onClick={() => void onDeleteGroup(group)}>Xóa</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GradingPage({
  students,
  assessments,
  onCreateAssessment,
  onUpdateAssessment,
  onDeleteAssessment,
}: {
  students: Array<{ id: string; fullName: string }>
  assessments: Array<{ id: string; studentId: string; title: string; score: number; date: string }>
  onCreateAssessment: (values: AssessmentFormValues) => Promise<void>
  onUpdateAssessment: (assessment: Assessment, values: AssessmentFormValues) => Promise<void>
  onDeleteAssessment: (assessment: Assessment) => Promise<void>
}) {
  const [quickTitle, setQuickTitle] = useState('Đánh giá nhanh')
  const [quickDate, setQuickDate] = useState(new Date().toISOString().slice(0, 10))
  const [quickScores, setQuickScores] = useState<Record<string, string>>({})
  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      studentId: students[0]?.id ?? '',
      title: '',
      score: 8,
      date: new Date().toISOString().slice(0, 10),
    },
  })

  useEffect(() => {
    if (students[0]?.id && !form.getValues('studentId')) {
      form.setValue('studentId', students[0].id)
    }
  }, [form, students])

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="panel p-6">
        <h3 className="text-xl font-semibold text-white">Ghi điểm mới</h3>
        <form
          className="mt-5 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onCreateAssessment(values)
            form.reset({
              studentId: students[0]?.id ?? '',
              title: '',
              score: 8,
              date: new Date().toISOString().slice(0, 10),
            })
          })}
        >
          <div>
            <label className="mb-2 block text-sm text-slate-300">Học sinh</label>
            <select {...form.register('studentId')} className="input-shell">
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Tên bài kiểm tra</label>
            <input {...form.register('title')} className="input-shell" placeholder="Ví dụ: Kiểm tra 15 phút" />
            {form.formState.errors.title && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Điểm số</label>
            <input type="number" step="0.1" min={0} max={10} {...form.register('score', { valueAsNumber: true })} className="input-shell" />
            {form.formState.errors.score && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.score.message}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Ngày đánh giá</label>
            <input type="date" {...form.register('date')} className="input-shell" />
            {form.formState.errors.date && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.date.message}</p>}
          </div>

          <button type="submit" className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-emerald-400">
            Lưu điểm
          </button>
        </form>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-slate-800 p-6">
          <h3 className="text-xl font-semibold text-white">Bảng điểm gần đây</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-6 py-3 font-medium">Học sinh</th>
                <th className="px-6 py-3 font-medium">Bài kiểm tra</th>
                <th className="px-6 py-3 font-medium">Điểm</th>
                <th className="px-6 py-3 font-medium">Ngày</th>
                <th className="px-6 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => {
                const student = students.find((entry) => entry.id === assessment.studentId)
                return (
                  <tr key={assessment.id} className="border-b border-slate-800/80 bg-slate-900/30">
                    <td className="px-6 py-4 font-medium text-white">{student?.fullName ?? 'Không rõ'}</td>
                    <td className="px-6 py-4 text-slate-300">{assessment.title}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-300">{assessment.score.toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{assessment.date}</td>
                    <td className="px-6 py-4">
                      <button type="button" className="mr-3 text-cyan-300" onClick={() => {
                        const title = window.prompt('Tên bài đánh giá', assessment.title)
                        const scoreText = window.prompt('Điểm số (0-10)', String(assessment.score))
                        const date = window.prompt('Ngày đánh giá (YYYY-MM-DD)', assessment.date)
                        const score = Number(scoreText)
                        if (title?.trim() && date?.trim() && Number.isFinite(score) && score >= 0 && score <= 10) void onUpdateAssessment(assessment as Assessment, { studentId: assessment.studentId, title: title.trim(), score, date: date.trim() })
                      }}>Sửa</button>
                      <button type="button" className="text-rose-300" onClick={() => void onDeleteAssessment(assessment as Assessment)}>Xóa</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel p-6 xl:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Đánh giá nhanh cả lớp</h3>
            <p className="mt-1 text-sm text-slate-400">Mỗi hàng là một học sinh, nhập điểm theo cùng một tiêu chí.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} className="input-shell w-52" placeholder="Tiêu chí đánh giá" />
            <input type="date" value={quickDate} onChange={(event) => setQuickDate(event.target.value)} className="input-shell" />
            <button type="button" onClick={() => void Promise.all(students.filter((student) => quickScores[student.id] !== undefined && quickScores[student.id] !== '').map((student) => onCreateAssessment({ studentId: student.id, title: quickTitle, score: Math.max(0, Math.min(10, Number(quickScores[student.id]))), date: quickDate })))} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">Lưu cả lớp</button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th className="px-3 py-2">Học sinh</th><th className="px-3 py-2">{quickTitle}</th><th className="px-3 py-2">Trạng thái</th></tr></thead>
            <tbody>
              {students.map((student) => {
                const value = quickScores[student.id] ?? ''
                return <tr key={student.id} className="border-t border-slate-800"><td className="px-3 py-3 font-medium text-white">{student.fullName}</td><td className="px-3 py-3"><input type="number" min={0} max={10} step="0.1" value={value} onChange={(event) => setQuickScores((current) => ({ ...current, [student.id]: event.target.value }))} className="input-shell w-28" aria-label={`Điểm ${student.fullName}`} /></td><td className="px-3 py-3 text-slate-400">{value === '' ? 'Chưa nhập' : Number(value) >= 5 ? 'Đạt' : 'Cần hỗ trợ'}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RewardsPage({
  students,
  rewards,
  totalPoints,
  onAddReward,
  onUpdateReward,
  onDeleteReward,
  groups,
}: {
  students: Array<{ id: string; fullName: string }>
  rewards: Array<{ id: string; studentId: string; title: string; points: number; type: string; createdAt?: string }>
  totalPoints: number
  onAddReward: (values: RewardFormValues) => Promise<void>
  onUpdateReward: (reward: Reward, values: RewardFormValues) => Promise<void>
  onDeleteReward: (reward: Reward) => Promise<void>
  groups: StudentGroup[]
}) {
  const [activePresetTab, setActivePresetTab] = useState<RewardPresetKind>('positive')
  const [rewardPresets, setRewardPresets] = useState<RewardPreset[]>(defaultRewardPresets)
  const [hasLoadedPresets, setHasLoadedPresets] = useState(false)
  const [newPreset, setNewPreset] = useState({ label: '', points: 1, kind: 'positive' as RewardPresetKind })

  const form = useForm<RewardFormValues>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      studentId: students[0]?.id ?? '',
      groupId: '',
      title: '',
      type: 'points',
      points: 10,
    },
  })

  const pointsByStudent = useMemo(() => {
    return students.map((student) => ({
      student: student.fullName,
      points: rewards
        .filter((reward) => reward.studentId === student.id)
        .reduce((sum, reward) => sum + reward.points, 0),
    }))
  }, [rewards, students])

  useEffect(() => {
    if (students[0]?.id && !form.getValues('studentId')) {
      form.setValue('studentId', students[0].id)
    }
  }, [form, students])

  useEffect(() => {
    let active = true

    void db.settings.get(rewardPresetStorageKey).then((setting) => {
      if (!active) return

      if (setting && typeof setting.value === 'string') {
        try {
          const parsed = JSON.parse(setting.value) as RewardPreset[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRewardPresets(parsed)
          }
        } catch {
          // Ignore invalid preset data and keep defaults.
        }
      }

      setHasLoadedPresets(true)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedPresets) {
      return
    }

    void db.settings.put({
      id: rewardPresetStorageKey,
      key: rewardPresetStorageKey,
      value: JSON.stringify(rewardPresets),
      updatedAt: new Date().toISOString(),
    })
  }, [hasLoadedPresets, rewardPresets])

  const presetOptions = rewardPresets.filter((preset) => preset.kind === activePresetTab)

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Điểm thưởng và thành tích</h3>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">{totalPoints} điểm</span>
        </div>

        <div className="mt-5 rounder-xl border border-white/10 bg-slate-950/50 p-3">
          <div className="flex gap-2">
            {(['positive', 'negative'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setActivePresetTab(kind)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  activePresetTab === kind
                    ? 'border-violet-400 bg-violet-500/15 text-violet-200'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300'
                }`}
              >
                {kind === 'positive' ? 'Tích cực' : 'Cần cố gắng'}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {presetOptions.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  form.setValue('title', preset.label)
                  form.setValue('points', preset.points)
                  form.setValue('type', 'points')
                }}
                className="flex min-h-[110px] flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/50 p-4 text-center transition hover:border-violet-400 hover:bg-violet-500/10"
              >
                <span className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-xl font-semibold ${preset.points >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  {formatRewardPoints(preset.points)}
                </span>
                <span className="text-sm font-medium text-slate-100">{preset.label}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                const label = newPreset.label.trim()
                if (!label) return

                const nextPreset: RewardPreset = {
                  id: `custom-${Date.now()}`,
                  label,
                  points: Math.max(-500, Math.min(500, Number(newPreset.points) || 1)),
                  kind: newPreset.kind,
                }

                setRewardPresets((current) => [nextPreset, ...current])
                setNewPreset({ label: '', points: 1, kind: activePresetTab })
                setActivePresetTab(newPreset.kind)
                form.setValue('title', nextPreset.label)
                form.setValue('points', nextPreset.points)
                form.setValue('type', 'points')
              }}
              className="flex min-h-[110px] flex-col items-center justify-center rounded-2xl border border-dashed border-violet-400/60 bg-violet-500/5 p-4 text-center text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/10"
            >
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/60 text-2xl font-light">+</span>
              <span className="text-sm font-medium">Thêm mẫu</span>
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="grid gap-3 md:grid-cols-[1.3fr_100px_120px_auto]">
              <input
                value={newPreset.label}
                onChange={(event) => setNewPreset((current) => ({ ...current, label: event.target.value }))}
                className="input-shell"
                placeholder="Tên mẫu"
              />
              <input
                type="number"
                value={newPreset.points}
                onChange={(event) => setNewPreset((current) => ({ ...current, points: Number(event.target.value) || 1 }))}
                className="input-shell"
                placeholder="Điểm"
              />
              <select
                value={newPreset.kind}
                onChange={(event) => setNewPreset((current) => ({ ...current, kind: event.target.value as RewardPresetKind }))}
                className="input-shell"
              >
                <option value="positive">Tích cực</option>
                <option value="negative">Cần cố gắng</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const label = newPreset.label.trim()
                  if (!label) return

                  const nextPreset: RewardPreset = {
                    id: `custom-${Date.now()}`,
                    label,
                    points: Math.max(-500, Math.min(500, Number(newPreset.points) || 1)),
                    kind: newPreset.kind,
                  }

                  setRewardPresets((current) => [nextPreset, ...current])
                  setNewPreset({ label: '', points: 1, kind: nextPreset.kind })
                  setActivePresetTab(nextPreset.kind)
                }}
                className="rounded-xl bg-violet-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
              >
                Lưu mẫu
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {rewards.map((reward) => (
            <div key={reward.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div>
                <p className="font-medium text-white">{reward.title}</p>
                <p className="text-sm text-slate-400">{reward.type}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-lg px-2 py-1 text-sm font-medium ${reward.points >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{formatRewardPoints(reward.points)}</span>
                <button type="button" className="text-cyan-300" onClick={() => {
                  const title = window.prompt('Tên phần thưởng', reward.title)
                  const pointsText = window.prompt('Số điểm', String(reward.points))
                  const points = Number(pointsText)
                  if (title?.trim() && Number.isFinite(points)) void onUpdateReward(reward as Reward, { studentId: reward.studentId, groupId: '', title: title.trim(), type: reward.type as RewardFormValues['type'], points })
                }}>Sửa</button>
                <button type="button" className="text-rose-300" onClick={() => { if (window.confirm(`Xóa "${reward.title}"?`)) void onDeleteReward(reward as Reward) }}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-white">Chuyển điểm mới</h3>
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await onAddReward(values)
              form.reset({
                studentId: students[0]?.id ?? '',
                groupId: '',
                title: '',
                type: 'points',
                points: 10,
              })
            })}
          >
            <div>
              <label className="mb-2 block text-sm text-slate-300">Học sinh</label>
              <select {...form.register('studentId')} className="input-shell">
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Hoặc áp dụng cho nhóm</label>
              <select {...form.register('groupId')} className="input-shell">
                <option value="">Không chọn nhóm</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.studentIds.length} HS)</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Tên phần thưởng</label>
              <input {...form.register('title')} className="input-shell" placeholder="Ví dụ: Hoàn thành tốt nhiệm vụ" />
              {form.formState.errors.title && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.title.message}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Loại</label>
                <select {...form.register('type')} className="input-shell">
                  <option value="points">Điểm</option>
                  <option value="badge">Huy hiệu</option>
                  <option value="certificate">Chứng chỉ</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Số điểm</label>
                <input type="number" {...form.register('points', { valueAsNumber: true })} className="input-shell" min={-500} max={500} />
                {form.formState.errors.points && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.points.message}</p>}
              </div>
            </div>

            <button type="submit" className="w-full rounded-xl bg-amber-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-amber-400">
              Lưu phần thưởng
            </button>
          </form>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-white">Bảng xếp hạng</h3>
          <div className="mt-6 space-y-3">
            {pointsByStudent
              .sort((a, b) => b.points - a.points)
              .map((entry, index) => (
                <div key={entry.student} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-300">
                      {index + 1}
                    </div>
                    <span className="text-white">{entry.student}</span>
                  </div>
                  <span className="font-medium text-amber-300">{entry.points}p</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AssignmentsPage({
  assignments,
  onCreateAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
}: {
  assignments: Array<{ id: string; title: string; description: string; dueDate: string; status: string }>
  onCreateAssignment: (values: AssignmentFormValues) => Promise<void>
  onUpdateAssignment: (assignment: Assignment, values: AssignmentFormValues) => Promise<void>
  onDeleteAssignment: (assignment: Assignment) => Promise<void>
}) {
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: '',
      description: '',
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'todo',
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="panel p-6">
        <h3 className="text-xl font-semibold text-white">Danh sách bài tập</h3>
        <div className="mt-6 space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">{assignment.title}</p>
                <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                  {assignment.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{assignment.description}</p>
              <p className="mt-3 text-xs text-slate-500">Hạn nộp: {assignment.dueDate}</p>
              <div className="mt-3">
                <button type="button" className="mr-3 text-sm text-cyan-300" onClick={() => {
                  const title = window.prompt('Tên bài tập', assignment.title)
                  const description = window.prompt('Ghi chú', assignment.description)
                  const dueDate = window.prompt('Ngày dự kiến (YYYY-MM-DD)', assignment.dueDate)
                  const status = window.prompt('Trạng thái (todo/doing/done)', assignment.status)
                  if (title?.trim() && description !== null && dueDate?.trim() && status?.trim()) void onUpdateAssignment(assignment as Assignment, { title: title.trim(), description, dueDate: dueDate.trim(), status: status as AssignmentFormValues['status'] })
                }}>Sửa</button>
                <button type="button" className="text-sm text-rose-300" onClick={() => { if (window.confirm(`Xóa ghi chú "${assignment.title}"?`)) void onDeleteAssignment(assignment as Assignment) }}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="text-xl font-semibold text-white">Tạo bài tập mới</h3>
        <form
          className="mt-5 space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onCreateAssignment(values)
            form.reset({
              title: '',
              description: '',
              dueDate: new Date().toISOString().slice(0, 10),
              status: 'todo',
            })
          })}
        >
          <div>
            <label className="mb-2 block text-sm text-slate-300">Tên bài tập</label>
            <input {...form.register('title')} className="input-shell" placeholder="Ví dụ: Bài thực hành số 3" />
            {form.formState.errors.title && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Mô tả</label>
            <textarea {...form.register('description')} className="input-shell min-h-24" placeholder="Mô tả bài tập, mục tiêu, tiêu chí chấm điểm..." />
            {form.formState.errors.description && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.description.message}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Hạng mục</label>
              <select {...form.register('status')} className="input-shell">
                <option value="todo">Chờ làm</option>
                <option value="review">Đang xem xét</option>
                <option value="done">Hoàn thành</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Hạn nộp</label>
              <input type="date" {...form.register('dueDate')} className="input-shell" />
              {form.formState.errors.dueDate && <p className="mt-1 text-xs text-rose-400">{form.formState.errors.dueDate.message}</p>}
            </div>
          </div>

          <button type="submit" className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 font-medium text-slate-950 transition hover:bg-cyan-400">
            Lưu bài tập
          </button>
        </form>
      </div>
    </div>
  )
}

function ReportsPage({
  students,
  classes,
  attendance,
  rewards,
  assessments,
  assignments,
  syncQueue,
}: {
  students: Array<{ id: string; fullName: string; phone: string; status: string; classId: string }>
  classes: Array<{ id: string; name: string; teacherName: string; room: string; status: string }>
  attendance: Array<{ studentId: string; status: string; date: string }>
  rewards: Array<{ studentId: string; title: string; points: number; type: string }>
  assessments: Array<{ studentId: string; title: string; score: number; date: string }>
  assignments: Array<{ title: string; dueDate: string; status: string }>
  syncQueue: Array<{ status: string }>
}) {
  const totalPoints = rewards.reduce((sum, reward) => sum + reward.points, 0)
  const averageScore = assessments.length > 0
    ? assessments.reduce((sum, item) => sum + item.score, 0) / assessments.length
    : 0
  const attendanceSummary = {
    present: attendance.filter((record) => record.status === 'present').length,
    late: attendance.filter((record) => record.status === 'late').length,
    absent: attendance.filter((record) => record.status === 'absent').length,
    excused: attendance.filter((record) => record.status === 'excused').length,
  }

  const downloadCsv = (filename: string, rows: Array<Record<string, string | number | boolean>>) => {
    if (rows.length === 0) {
      rows = [{ message: 'No data' }]
    }

    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => {
      const value = row[header]
      const safeValue = String(value ?? '').replace(/"/g, '""')
      return `"${safeValue}"`
    }).join(','))].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportStudentCsv = () => {
    downloadCsv(
      'classroom-hub-hoc-sinh.csv',
      students.map((student) => ({
        id: student.id,
        ho_ten: student.fullName,
        so_dien_thoai: student.phone,
        lop: student.classId,
        trang_thai: student.status,
      })),
    )
  }

  const exportAttendanceCsv = () => {
    downloadCsv(
      'classroom-hub-chuyen-can.csv',
      attendance.map((item) => ({
        date: item.date,
        studentId: item.studentId,
        status: item.status,
      })),
    )
  }

  const exportReportCsv = () => {
    const summaryRows = [{
      tong_hoc_sinh: students.length,
      tong_lop: classes.length,
      tong_bai_tap: assignments.length,
      diem_trung_binh: averageScore.toFixed(1),
      tong_diem_thuong: totalPoints,
      co_mat: attendanceSummary.present,
      muon: attendanceSummary.late,
      vang: attendanceSummary.absent,
      phep: attendanceSummary.excused,
      pending_sync: syncQueue.filter((item) => item.status === 'pending').length,
    }]

    downloadCsv('classroom-hub-bao-cao-tong-hop.csv', summaryRows)
  }

  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Báo cáo</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Xuất dữ liệu & tổng quan</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportStudentCsv} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400">
              Xuất học sinh CSV
            </button>
            <button type="button" onClick={exportAttendanceCsv} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400">
              Xuất chuyên cần CSV
            </button>
            <button type="button" onClick={exportReportCsv} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400">
              Xuất báo cáo tổng hợp
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Users className="h-5 w-5" />} label="Tổng học sinh" value={String(students.length)} tone="cyan" />
        <MetricCard icon={<BookMarked className="h-5 w-5" />} label="Lớp đang mở" value={String(classes.length)} tone="violet" />
        <MetricCard icon={<CheckCheck className="h-5 w-5" />} label="Điểm trung bình" value={averageScore.toFixed(1)} tone="emerald" />
        <MetricCard icon={<Trophy className="h-5 w-5" />} label="Tổng điểm" value={String(totalPoints)} tone="amber" />
      </div>

      <div className="panel p-6">
        <h3 className="text-lg font-semibold text-white">Tóm tắt hoạt động</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Có mặt" value={String(attendanceSummary.present)} accent="cyan" />
          <MiniStat label="Muộn" value={String(attendanceSummary.late)} accent="amber" />
          <MiniStat label="Vắng" value={String(attendanceSummary.absent)} accent="violet" />
          <MiniStat label="Phép" value={String(attendanceSummary.excused)} accent="emerald" />
        </div>
      </div>
    </div>
  )
}

function SyncPage({
  syncQueue,
  isOnline,
  onSyncNow,
}: {
  syncQueue: Array<{ id: string; entityType: string; status: string; createdAt: string; retryCount?: number; nextRetryAt?: string; lastError?: string }>
  isOnline: boolean
  onSyncNow: () => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <div className="panel p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Đồng bộ dữ liệu</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Sync queue</h3>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${isOnline ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {isOnline ? 'Đã kết nối' : 'Chờ mạng'}
            </span>
            <button
              type="button"
              onClick={() => void onSyncNow()}
              disabled={!isOnline}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloudSun className="h-4 w-4" />
              {isOnline ? 'Gửi lên Supabase' : 'Chờ kết nối mạng'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-6 py-3 font-medium">Entity</th>
                <th className="px-6 py-3 font-medium">Thời điểm</th>
                <th className="px-6 py-3 font-medium">Trạng thái</th>
                <th className="px-6 py-3 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {syncQueue.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                    Không có giao dịch đang chờ
                  </td>
                </tr>
              ) : (
                syncQueue.map((item) => {
                  const statusInfo = syncStatusInfo(item.status, isOnline, item.retryCount, item.nextRetryAt)

                  return (
                    <tr key={item.id} className="border-b border-slate-800/80 bg-slate-900/30 align-top">
                      <td className="px-6 py-4 font-medium text-white">{item.entityType}</td>
                      <td className="px-6 py-4 text-slate-300">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(item.status)}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {item.lastError ? (
                          <span className="block text-xs text-rose-300">{item.lastError}</span>
                        ) : (
                          <span className="text-xs text-slate-400">{statusInfo.detail}</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'cyan' | 'violet' | 'emerald' | 'amber' }) {
  const palette = {
    cyan: 'from-cyan-500/20 to-cyan-400/5 text-cyan-200 border-cyan-500/20',
    violet: 'from-violet-500/20 to-violet-400/5 text-violet-200 border-violet-500/20',
    emerald: 'from-emerald-500/20 to-emerald-400/5 text-emerald-200 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-400/5 text-amber-200 border-amber-500/20',
  }

  return (
    <div className={`rounded-[26px] border border-white/10 bg-gradient-to-br p-4 shadow-[0_18px_45px_rgba(15,23,42,0.28)] backdrop-blur-xl ${palette[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">{icon}</div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Live</span>
      </div>
      <p className="mt-6 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{label}</p>
    </div>
  )
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-medium text-slate-100">{Math.round(value)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className={`${color} h-2.5 rounded-full shadow-[0_0_18px_rgba(34,211,238,0.22)]`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: 'amber' | 'cyan' | 'violet' | 'emerald' }) {
  const palette = {
    amber: 'bg-amber-500/10 text-amber-200 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20',
    violet: 'bg-violet-500/10 text-violet-200 border-violet-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20',
  }

  return (
    <div className={`rounded-2xl border border-white/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${palette[accent]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-xl font-semibold text-white">{value}</span>
      </div>
    </div>
  )
}

function syncStatusInfo(status: string, isOnline: boolean, retryCount = 0, nextRetryAt?: string) {
  switch (status) {
    case 'pending':
      return {
        label: isOnline ? 'Đang đồng bộ' : 'Chờ mạng',
        detail: isOnline ? `Thử lại lần ${retryCount + 1}` : 'Sẽ tự đồng bộ khi có internet',
      }
    case 'synced':
      return {
        label: 'Đã đồng bộ',
        detail: 'Đã cập nhật lên Supabase',
      }
    case 'failed':
      return {
        label: isOnline ? 'Lỗi đồng bộ' : 'Chờ mạng',
        detail: nextRetryAt ? `Thử lại sau ${new Date(nextRetryAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Sẽ thử lại khi có mạng',
      }
    default:
      return {
        label: 'Không xác định',
        detail: 'Chưa có trạng thái đồng bộ',
      }
  }
}

function statusTone(status: string) {
  switch (status) {
    case 'present':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
    case 'late':
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
    case 'absent':
      return 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
    case 'excused':
      return 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
    case 'active':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
    case 'at-risk':
      return 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
    case 'inactive':
      return 'bg-slate-600/20 text-slate-300 border border-slate-600/20'
    case 'pending':
      return 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
    case 'failed':
      return 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
    case 'synced':
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
    default:
      return 'bg-slate-700/30 text-slate-200 border border-slate-700'
  }
}

export default App
