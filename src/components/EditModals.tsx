import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import type { School, ClassRoom, Student, StudentGroup, Assessment, Reward, Assignment } from '../types'

// 1. Edit School Modal
interface EditSchoolModalProps {
  school: School | null
  isOpen: boolean
  onClose: () => void
  onSave: (school: School, values: { name: string; address: string }) => Promise<void>
}

export function EditSchoolModal({ school, isOpen, onClose, onSave }: EditSchoolModalProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (school) {
      setName(school.name)
      setAddress(school.address)
    }
  }, [school])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school || !name.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(school, { name: name.trim(), address: address.trim() })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa thông tin trường" subtitle="Cập nhật tên và địa chỉ của trường">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Tên trường *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-shell"
            placeholder="Nhập tên trường học..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Địa chỉ</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-shell"
            placeholder="Địa chỉ trường học..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="soft-secondary">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSubmitting || !name.trim()} className="soft-primary">
            {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 2. Edit Class Modal
interface EditClassModalProps {
  classItem: ClassRoom | null
  isOpen: boolean
  onClose: () => void
  onSave: (classRoom: ClassRoom, values: { name: string; teacherName: string; room: string; status?: 'active' | 'archived' }) => Promise<void>
}

export function EditClassModal({ classItem, isOpen, onClose, onSave }: EditClassModalProps) {
  const [name, setName] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [room, setRoom] = useState('')
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (classItem) {
      setName(classItem.name)
      setTeacherName(classItem.teacherName)
      setRoom(classItem.room)
      setStatus(classItem.status || 'active')
    }
  }, [classItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classItem || !name.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(classItem, {
        name: name.trim(),
        teacherName: teacherName.trim(),
        room: room.trim(),
        status,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa thông tin lớp học" subtitle="Cập nhật tên lớp, giáo viên và phòng học">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Tên lớp *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-shell"
            placeholder="Ví dụ: 10A1, 12 Tin..."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Giáo viên chủ nhiệm *</label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="input-shell"
              placeholder="Tên thầy/cô..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Phòng học *</label>
            <input
              type="text"
              required
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="input-shell"
              placeholder="Ví dụ: P.204..."
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Trạng thái lớp</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
            className="input-shell"
          >
            <option value="active">Đang giảng dạy (Active)</option>
            <option value="archived">Đã lưu trữ (Archived)</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="soft-secondary">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSubmitting || !name.trim()} className="soft-primary">
            {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 3. Edit Student Modal
interface EditStudentModalProps {
  student: Student | null
  isOpen: boolean
  onClose: () => void
  onSave: (student: Student, values: { fullName: string; phone: string; note: string; status: 'active' | 'at-risk' | 'inactive'; classId: string }) => Promise<void>
}

export function EditStudentModal({ student, isOpen, onClose, onSave }: EditStudentModalProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'active' | 'at-risk' | 'inactive'>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (student) {
      setFullName(student.fullName)
      setPhone(student.phone)
      setNote(student.note)
      setStatus(student.status)
    }
  }, [student])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student || !fullName.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(student, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        note: note.trim(),
        status,
        classId: student.classId,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa thông tin học sinh" subtitle="Cập nhật họ tên, liên lạc và hồ sơ học tập">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Họ và tên *</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-shell"
            placeholder="Họ và tên học sinh..."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Số điện thoại phụ huynh</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-shell"
              placeholder="09xx xxx xxx"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Trạng thái rèn luyện</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'at-risk' | 'inactive')}
              className="input-shell"
            >
              <option value="active">Bình thường (Active)</option>
              <option value="at-risk">Cần lưu ý (At-Risk)</option>
              <option value="inactive">Nghỉ học / Khác</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Ghi chú cá nhân</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="input-shell resize-none"
            placeholder="Ghi chú về học lực, sức khỏe, hoàn cảnh..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="soft-secondary">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSubmitting || !fullName.trim()} className="soft-primary">
            {isSubmitting ? 'Đang lưu...' : 'Lưu học sinh'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 4. Edit Group Modal
interface EditGroupModalProps {
  group: StudentGroup | null
  students: Array<{ id: string; fullName: string }>
  isOpen: boolean
  onClose: () => void
  onSave: (group: StudentGroup, name: string, studentIds: string[]) => Promise<void>
}

export function EditGroupModal({ group, students, isOpen, onClose, onSave }: EditGroupModalProps) {
  const [name, setName] = useState('')
  const [studentIds, setStudentIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (group) {
      setName(group.name)
      setStudentIds(group.studentIds || [])
    }
  }, [group])

  const filteredStudents = students.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!group || !name.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(group, name.trim(), studentIds)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleStudent = (id: string) => {
    setStudentIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa nhóm học tập" subtitle="Đổi tên nhóm và điều chỉnh thành viên">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Tên nhóm *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-shell"
            placeholder="Ví dụ: Nhóm 1 - Đội Sao Kim..."
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-slate-300">
              Thành viên ({studentIds.length} học sinh đã chọn)
            </label>
            <input
              type="text"
              placeholder="Tìm học sinh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-3 space-y-1.5">
            {filteredStudents.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={studentIds.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                />
                <span className="font-medium">{s.fullName}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="soft-secondary">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSubmitting || !name.trim()} className="soft-primary">
            {isSubmitting ? 'Đang lưu...' : 'Lưu nhóm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 5. Edit Assessment Modal
interface EditAssessmentModalProps {
  assessment: Assessment | null
  students: Array<{ id: string; fullName: string }>
  isOpen: boolean
  onClose: () => void
  onSave: (assessment: Assessment, values: { studentId: string; title: string; score: number; date: string }) => Promise<void>
  onDelete?: (assessment: Assessment) => Promise<void>
}

export function EditAssessmentModal({ assessment, students, isOpen, onClose, onSave, onDelete }: EditAssessmentModalProps) {
  const [studentId, setStudentId] = useState('')
  const [title, setTitle] = useState('')
  const [score, setScore] = useState<number>(8)
  const [date, setDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (assessment) {
      setStudentId(assessment.studentId)
      setTitle(assessment.title)
      setScore(assessment.score)
      setDate(assessment.date)
    }
  }, [assessment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assessment || !title.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(assessment, {
        studentId,
        title: title.trim(),
        score: Math.max(0, Math.min(10, Number(score))),
        date: date.trim(),
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!assessment || !onDelete) return
    if (window.confirm(`Xóa điểm bài kiểm tra "${assessment.title}"?`)) {
      setIsSubmitting(true)
      try {
        await onDelete(assessment)
        onClose()
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const categoryPresets = [
    'Điểm kiểm tra miệng',
    'Điểm chấm vở',
    'Điểm kiểm tra 15 phút',
    'Điểm kiểm tra thực hành',
    'Điểm kiểm tra 45 phút',
    'Điểm kiểm tra Giữa kỳ I',
    'Điểm kiểm tra Cuối kỳ 1',
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa điểm đánh giá" subtitle="Điều chỉnh cột điểm, điểm số và học sinh">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Học sinh</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="input-shell"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Tiêu chí / Tên bài kiểm tra *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-shell"
            placeholder="Ví dụ: Điểm kiểm tra 15 phút..."
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categoryPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTitle(preset)}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-400 hover:text-white"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Điểm số (0 - 10) *</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={10}
              required
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="input-shell text-lg font-bold text-cyan-300"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Ngày ghi điểm *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-shell"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
            >
              Xóa điểm này
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="soft-secondary">
              Hủy bỏ
            </button>
            <button type="submit" disabled={isSubmitting || !title.trim()} className="soft-primary">
              {isSubmitting ? 'Đang lưu...' : 'Lưu điểm'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// 6. Edit Reward Modal
interface EditRewardModalProps {
  reward: Reward | null
  isOpen: boolean
  onClose: () => void
  onSave: (reward: Reward, values: { targetType: 'student'; studentId: string; groupId: string; title: string; type: 'points' | 'badge' | 'certificate'; points: number }) => Promise<void>
}

export function EditRewardModal({ reward, isOpen, onClose, onSave }: EditRewardModalProps) {
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState(1)
  const [type, setType] = useState<'points' | 'badge' | 'certificate'>('points')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (reward) {
      setTitle(reward.title)
      setPoints(reward.points)
      setType(reward.type as 'points' | 'badge' | 'certificate')
    }
  }, [reward])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reward || !title.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(reward, {
        targetType: 'student',
        studentId: reward.studentId,
        groupId: '',
        title: title.trim(),
        type,
        points: Number(points) || 0,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa ghi nhận điểm thưởng" subtitle="Cập nhật tiêu chí kỹ năng và điểm thưởng/phạt">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Tên hành vi / Kỹ năng *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-shell"
            placeholder="Ví dụ: Giúp đỡ bạn bè..."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Điểm số (+ hoặc -) *</label>
            <input
              type="number"
              min={-500}
              max={500}
              required
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="input-shell text-lg font-bold"
            />
            <p className="mt-1 text-[11px] text-slate-400">Điểm dương (+) thưởng, điểm âm (-) cần cố gắng</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Hình thức ghi nhận</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'points' | 'badge' | 'certificate')}
              className="input-shell"
            >
              <option value="points">Điểm số</option>
              <option value="badge">Huy hiệu</option>
              <option value="certificate">Chứng nhận</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="soft-secondary">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSubmitting || !title.trim()} className="soft-primary">
            {isSubmitting ? 'Đang lưu...' : 'Lưu ghi nhận'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 7. Edit Assignment Modal
interface EditAssignmentModalProps {
  assignment: Assignment | null
  isOpen: boolean
  onClose: () => void
  onSave: (assignment: Assignment, values: { title: string; description: string; dueDate: string; status: 'todo' | 'review' | 'done' }) => Promise<void>
}

export function EditAssignmentModal({ assignment, isOpen, onClose, onSave }: EditAssignmentModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'todo' | 'review' | 'done'>('todo')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title)
      setDescription(assignment.description)
      setDueDate(assignment.dueDate)
      setStatus(assignment.status as 'todo' | 'review' | 'done')
    }
  }, [assignment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignment || !title.trim()) return
    setIsSubmitting(true)
    try {
      await onSave(assignment, {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate.trim(),
        status,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa bài tập / ghi chú" subtitle="Cập nhật nội dung, hạn nộp và tiến độ">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Tiêu đề bài tập *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-shell"
            placeholder="Tên bài tập..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Mô tả / Hướng dẫn</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input-shell resize-none"
            placeholder="Yêu cầu làm bài, tài liệu cần nộp..."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Hạn nộp</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input-shell"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">Trạng thái hoàn thành</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'todo' | 'review' | 'done')}
              className="input-shell"
            >
              <option value="todo">Cần làm (Todo)</option>
              <option value="review">Đang chấm (Review)</option>
              <option value="done">Hoàn thành (Done)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="soft-secondary">
            Hủy bỏ
          </button>
          <button type="submit" disabled={isSubmitting || !title.trim()} className="soft-primary">
            {isSubmitting ? 'Đang lưu...' : 'Lưu bài tập'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
