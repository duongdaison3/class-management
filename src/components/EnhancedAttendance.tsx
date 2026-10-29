import React, { useState, useMemo } from 'react'
import {
  CalendarDays,
  CheckCheck,
  Clock,
  UserX,
  FileCheck,
  Music,
  HeartPulse,
  Users,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Filter,
} from 'lucide-react'
import { attendanceLabels, type AttendanceRecord, type AttendanceStatus, type Student } from '../types'

interface EnhancedAttendanceProps {
  students: Student[]
  attendance: AttendanceRecord[]
  onMarkAttendance: (studentId: string, status: AttendanceStatus, date?: string) => Promise<void>
  onBulkAttendance: (studentIds: string[], status: AttendanceStatus, date: string) => Promise<void>
}

const statusConfig: Record<
  AttendanceStatus,
  { label: string; icon: React.ReactNode; tone: string; badge: string; btn: string }
> = {
  present: {
    label: 'Có mặt',
    icon: <CheckCheck className="h-3.5 w-3.5" />,
    tone: 'text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    btn: 'hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200',
  },
  late: {
    label: 'Đi muộn',
    icon: <Clock className="h-3.5 w-3.5" />,
    tone: 'text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    btn: 'hover:border-amber-400 hover:bg-amber-500/20 hover:text-amber-200',
  },
  absent: {
    label: 'Vắng mặt',
    icon: <UserX className="h-3.5 w-3.5" />,
    tone: 'text-rose-300',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    btn: 'hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-200',
  },
  excused: {
    label: 'Nghỉ có phép',
    icon: <FileCheck className="h-3.5 w-3.5" />,
    tone: 'text-sky-300',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    btn: 'hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200',
  },
  arts: {
    label: 'Văn nghệ',
    icon: <Music className="h-3.5 w-3.5" />,
    tone: 'text-purple-300',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    btn: 'hover:border-purple-400 hover:bg-purple-500/20 hover:text-purple-200',
  },
  health: {
    label: 'Y tế',
    icon: <HeartPulse className="h-3.5 w-3.5" />,
    tone: 'text-teal-300',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    btn: 'hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-200',
  },
}

export function EnhancedAttendance({
  students,
  attendance,
  onMarkAttendance,
  onBulkAttendance,
}: EnhancedAttendanceProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Check if today has attendance
  const todayRecords = useMemo(
    () => attendance.filter((r) => r.date === todayStr),
    [attendance, todayStr],
  )
  const isTodayAttended = todayRecords.length > 0

  // Records for current selected date
  const dateRecords = useMemo(
    () => attendance.filter((r) => r.date === selectedDate),
    [attendance, selectedDate],
  )

  // Count by status for current selected date
  const stats = useMemo(() => {
    let present = 0
    let late = 0
    let absent = 0
    let excused = 0
    let arts = 0
    let health = 0

    const recordedStudentIds = new Set<string>()

    for (const r of dateRecords) {
      recordedStudentIds.add(r.studentId)
      if (r.status === 'present') present++
      else if (r.status === 'late') late++
      else if (r.status === 'absent') absent++
      else if (r.status === 'excused') excused++
      else if (r.status === 'arts') arts++
      else if (r.status === 'health') health++
    }

    const unmarked = Math.max(0, students.length - recordedStudentIds.size)

    return {
      total: students.length,
      present,
      late,
      absent,
      excused,
      arts,
      health,
      unmarked,
      attendedRatio:
        students.length > 0 ? Math.round(((present + late + arts) / students.length) * 100) : 0,
    }
  }, [dateRecords, students.length])

  // Filter students based on status filter
  const filteredStudents = useMemo(() => {
    if (statusFilter === 'all') return students
    if (statusFilter === 'unmarked') {
      const markedIds = new Set(dateRecords.map((r) => r.studentId))
      return students.filter((s) => !markedIds.has(s.id))
    }
    const matchingIds = new Set(
      dateRecords.filter((r) => r.status === statusFilter).map((r) => r.studentId),
    )
    return students.filter((s) => matchingIds.has(s.id))
  }, [students, dateRecords, statusFilter])

  // Mark all present today
  const handleMarkAllPresentToday = async () => {
    const allIds = students.map((s) => s.id)
    await onBulkAttendance(allIds, 'present', selectedDate)
  }

  const handleApplyBulk = async () => {
    const idsToApply =
      selectedStudentIds.length > 0 ? selectedStudentIds : students.map((s) => s.id)
    await onBulkAttendance(idsToApply, bulkStatus, selectedDate)
    setSelectedStudentIds([])
  }

  const toggleSelect = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Today's Attendance Status Alert Card */}
      <div
        className={`liquid-glass p-6 border transition-all ${
          isTodayAttended
            ? 'border-emerald-500/30 bg-emerald-950/20'
            : 'border-amber-500/30 bg-amber-950/20'
        }`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-lg ${
                isTodayAttended
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
              }`}
            >
              {isTodayAttended ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                    isTodayAttended
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  }`}
                >
                  {isTodayAttended ? 'Đã điểm danh hôm nay' : 'Chưa điểm danh hôm nay'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date().toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <h2 className="mt-1 text-xl font-bold text-white">
                {isTodayAttended
                  ? `Đã ghi nhận điểm danh cho ${todayRecords.length} / ${students.length} học sinh hôm nay.`
                  : 'Chưa có dữ liệu chuyên cần cho ngày hôm nay!'}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2">
              <CalendarDays className="h-4 w-4 text-cyan-300" />
              <span className="text-xs text-slate-400">Chọn ngày:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white outline-none"
              />
            </div>

            {!isTodayAttended && selectedDate === todayStr && (
              <button
                type="button"
                onClick={handleMarkAllPresentToday}
                className="soft-primary px-4 py-2 text-xs font-bold shadow-lg"
              >
                <Zap className="h-4 w-4" />
                <span>Điểm danh tất cả Có mặt</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Metrics Strip for Selected Date */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 border-t border-white/10 pt-4">
          {/* Total */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400">
              <Users className="h-3.5 w-3.5" /> Sĩ số
            </div>
            <div className="mt-1 text-2xl font-bold text-white">{stats.total}</div>
          </div>

          {/* Present */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-300">
              <CheckCheck className="h-3.5 w-3.5" /> Có mặt
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-300">{stats.present}</div>
          </div>

          {/* Late */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-300">
              <Clock className="h-3.5 w-3.5" /> Đi muộn
            </div>
            <div className="mt-1 text-2xl font-bold text-amber-300">{stats.late}</div>
          </div>

          {/* Absent */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-300">
              <UserX className="h-3.5 w-3.5" /> Vắng mặt
            </div>
            <div className="mt-1 text-2xl font-bold text-rose-300">{stats.absent}</div>
          </div>

          {/* Excused */}
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-sky-300">
              <FileCheck className="h-3.5 w-3.5" /> Có phép
            </div>
            <div className="mt-1 text-2xl font-bold text-sky-300">{stats.excused}</div>
          </div>

          {/* Arts (Văn nghệ) - NEW */}
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-purple-300">
              <Music className="h-3.5 w-3.5" /> Văn nghệ
            </div>
            <div className="mt-1 text-2xl font-bold text-purple-300">{stats.arts}</div>
          </div>

          {/* Health (Y tế) - NEW */}
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/10 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-teal-300">
              <HeartPulse className="h-3.5 w-3.5" /> Y tế
            </div>
            <div className="mt-1 text-2xl font-bold text-teal-300">{stats.health}</div>
          </div>

          {/* Unmarked */}
          <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400">
              Chưa ghi
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-400">{stats.unmarked}</div>
          </div>
        </div>
      </div>

      {/* 3. Bulk Action & Filter Bar */}
      <div className="liquid-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedStudentIds(students.map((s) => s.id))}
              className="soft-ghost text-xs"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              className="soft-ghost text-xs"
            >
              Bỏ chọn
            </button>

            <span className="text-slate-500 text-xs mx-1">|</span>

            {/* Select status dropdown including Arts and Health */}
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-cyan-400"
            >
              <option value="present">Có mặt</option>
              <option value="late">Đi muộn</option>
              <option value="absent">Vắng mặt</option>
              <option value="excused">Nghỉ có phép</option>
              <option value="arts">Văn nghệ (Arts)</option>
              <option value="health">Y tế (Health)</option>
            </select>

            <button
              type="button"
              onClick={handleApplyBulk}
              className="soft-primary text-xs py-1.5 px-3"
            >
              Áp dụng cho{' '}
              {selectedStudentIds.length > 0 ? `${selectedStudentIds.length} HS đã chọn` : 'cả lớp'}
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Lọc:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === 'all'
                  ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Tất cả ({students.length})
            </button>
            {(['absent', 'late', 'excused', 'arts', 'health'] as AttendanceStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  statusFilter === st
                    ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {attendanceLabels[st]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Attendance Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-5 py-3.5 w-12 font-semibold">Chọn</th>
                <th className="px-5 py-3.5 font-semibold">Học sinh</th>
                <th className="px-5 py-3.5 font-semibold">Trạng thái ngày {selectedDate}</th>
                <th className="px-5 py-3.5 font-semibold">Ghi nhận nhanh (Bấm để chọn)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStudents.map((student) => {
                const record = dateRecords.find((r) => r.studentId === student.id)
                const currentStatus = record?.status as AttendanceStatus | undefined
                const isSelected = selectedStudentIds.includes(student.id)

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-800/30 transition-colors bg-slate-900/30"
                  >
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(student.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400"
                        aria-label={`Chọn ${student.fullName}`}
                      />
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      <div>
                        <span>{student.fullName}</span>
                        {student.phone && (
                          <span className="block text-xs font-normal text-slate-400">
                            {student.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {currentStatus ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${statusConfig[currentStatus].badge}`}
                        >
                          {statusConfig[currentStatus].icon}
                          {statusConfig[currentStatus].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-800/60 px-2.5 py-1 text-xs text-slate-400 border border-slate-700/50">
                          Chưa ghi nhận
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          ['present', 'late', 'absent', 'excused', 'arts', 'health'] as AttendanceStatus[]
                        ).map((st) => {
                          const conf = statusConfig[st]
                          const isActive = currentStatus === st

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => void onMarkAttendance(student.id, st, selectedDate)}
                              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold border transition ${
                                isActive
                                  ? `${conf.badge} shadow-sm ring-1 ring-white/30 scale-105`
                                  : `border-white/10 bg-white/5 text-slate-300 ${conf.btn}`
                              }`}
                            >
                              {conf.icon}
                              <span>{conf.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    Không có học sinh nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
