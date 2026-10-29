import { useState, useMemo } from 'react'
import {
  Users,
  UserCheck,
  CheckSquare,
  Square,
  Sparkles,
  History,
  Plus,
  Trash2,
  Edit2,
  ThumbsUp,
  AlertCircle,
  Award,
} from 'lucide-react'
import { Modal } from './Modal'
import { EditRewardModal } from './EditModals'
import type { Reward, Student, StudentGroup } from '../types'

export type SkillPreset = {
  id: string
  label: string
  points: number
  kind: 'positive' | 'negative'
  icon: string
}

export const defaultClassDojoSkills: SkillPreset[] = [
  // Positive skills
  { id: 'pos-1', label: 'Giúp đỡ bạn bè', points: 1, kind: 'positive', icon: '🤝' },
  { id: 'pos-2', label: 'Chăm chỉ làm bài', points: 1, kind: 'positive', icon: '✍️' },
  { id: 'pos-3', label: 'Tham gia phát biểu', points: 1, kind: 'positive', icon: '🙋' },
  { id: 'pos-4', label: 'Làm việc nhóm tốt', points: 1, kind: 'positive', icon: '👥' },
  { id: 'pos-5', label: 'Sáng tạo & Độc đáo', points: 2, kind: 'positive', icon: '💡' },
  { id: 'pos-6', label: 'Hoàn thành bài tập', points: 1, kind: 'positive', icon: '📚' },
  { id: 'pos-7', label: 'Tự giác, gương mẫu', points: 1, kind: 'positive', icon: '⭐' },
  { id: 'pos-8', label: 'Đi học đúng giờ', points: 1, kind: 'positive', icon: '⏰' },
  { id: 'pos-9', label: 'Giữ vệ sinh chung', points: 1, kind: 'positive', icon: '🧹' },
  { id: 'pos-10', label: 'Kiên trì vượt khó', points: 2, kind: 'positive', icon: '🎯' },
  { id: 'pos-11', label: 'Đạt điểm tốt', points: 2, kind: 'positive', icon: '🏅' },

  // Needs work skills
  { id: 'neg-1', label: 'Mất tập trung', points: -1, kind: 'negative', icon: '💤' },
  { id: 'neg-2', label: 'Nói chuyện riêng', points: -1, kind: 'negative', icon: '🗣️' },
  { id: 'neg-3', label: 'Chưa làm bài tập', points: -1, kind: 'negative', icon: '📝' },
  { id: 'neg-4', label: 'Đi học muộn', points: -1, kind: 'negative', icon: '🏃' },
  { id: 'neg-5', label: 'Quên đồ dùng học tập', points: -1, kind: 'negative', icon: '🎒' },
  { id: 'neg-6', label: 'Không tuân thủ nội quy', points: -2, kind: 'negative', icon: '⚠️' },
  { id: 'neg-7', label: 'Gây mất trật tự', points: -1, kind: 'negative', icon: '💢' },
  { id: 'neg-8', label: 'Sử dụng điện thoại', points: -2, kind: 'negative', icon: '📱' },
]

// Generate cute avatar styles based on student name
const getMonsterAvatar = (name: string, index: number) => {
  const monsterColors = [
    'from-emerald-400 to-teal-600',
    'from-cyan-400 to-blue-600',
    'from-violet-400 to-purple-600',
    'from-fuchsia-400 to-pink-600',
    'from-amber-400 to-orange-600',
    'from-rose-400 to-red-600',
    'from-indigo-400 to-blue-700',
    'from-lime-400 to-emerald-600',
  ]
  const monsterFaces = ['👾', '🤖', '🦊', '🐼', '🦁', '🐸', '🦄', '🐨', '🐯', '🐙']
  const colorIndex = (name.length + index) % monsterColors.length
  const faceIndex = (name.charCodeAt(0) + index) % monsterFaces.length
  return {
    color: monsterColors[colorIndex],
    face: monsterFaces[faceIndex],
  }
}

interface ClassDojoRewardsProps {
  students: Student[]
  rewards: Reward[]
  groups: StudentGroup[]
  totalPoints: number
  onAddReward: (values: {
    targetType: 'class' | 'group' | 'student' | 'students'
    studentId?: string
    studentIds?: string[]
    groupId?: string
    title: string
    type: 'points' | 'badge' | 'certificate'
    points: number
  }) => Promise<void>
  onUpdateReward: (
    reward: Reward,
    values: {
      targetType: 'student'
      studentId: string
      groupId: string
      title: string
      type: 'points' | 'badge' | 'certificate'
      points: number
    },
  ) => Promise<void>
  onDeleteReward: (reward: Reward) => Promise<void>
}

export function ClassDojoRewards({
  students,
  rewards,
  groups,
  totalPoints,
  onAddReward,
  onUpdateReward,
  onDeleteReward,
}: ClassDojoRewardsProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'groups' | 'history'>('students')
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  // Modal states for giving points
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false)
  const [awardTarget, setAwardTarget] = useState<{
    type: 'class' | 'group' | 'student' | 'students'
    title: string
    studentId?: string
    studentIds?: string[]
    groupId?: string
  } | null>(null)

  const [skills, setSkills] = useState<SkillPreset[]>(defaultClassDojoSkills)
  const [skillCategoryTab, setSkillCategoryTab] = useState<'positive' | 'negative'>('positive')
  const [isAddingCustomSkill, setIsAddingCustomSkill] = useState(false)
  const [customSkill, setCustomSkill] = useState({ label: '', points: 1, icon: '🌟' })

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Editing existing reward modal
  const [editingReward, setEditingReward] = useState<Reward | null>(null)

  // Calculate points per student
  const studentPointsMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of students) {
      map.set(s.id, 0)
    }
    for (const r of rewards) {
      const current = map.get(r.studentId) ?? 0
      map.set(r.studentId, current + r.points)
    }
    return map
  }, [students, rewards])

  // Calculate points per group
  const groupPointsMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of groups) {
      const gPoints = g.studentIds.reduce((sum, sId) => sum + (studentPointsMap.get(sId) ?? 0), 0)
      map.set(g.id, gPoints)
    }
    return map
  }, [groups, studentPointsMap])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur))
    }, 3000)
  }

  // Open award modal for target
  const handleOpenAward = (target: {
    type: 'class' | 'group' | 'student' | 'students'
    title: string
    studentId?: string
    studentIds?: string[]
    groupId?: string
  }) => {
    setAwardTarget(target)
    setSkillCategoryTab('positive')
    setIsAwardModalOpen(true)
  }

  // Award a skill
  const handleGiveSkill = async (skill: SkillPreset) => {
    if (!awardTarget) return
    setIsAwardModalOpen(false)

    try {
      await onAddReward({
        targetType: awardTarget.type,
        studentId: awardTarget.studentId,
        studentIds: awardTarget.studentIds,
        groupId: awardTarget.groupId,
        title: skill.label,
        type: 'points',
        points: skill.points,
      })

      const ptsText = skill.points > 0 ? `+${skill.points}` : `${skill.points}`
      showToast(`🎉 Đã trao ${ptsText} điểm "${skill.label}" cho ${awardTarget.title}!`)

      if (isMultiSelectMode) {
        setIsMultiSelectMode(false)
        setSelectedStudentIds([])
      }
    } catch {
      showToast('❌ Có lỗi xảy ra khi lưu điểm!')
    }
  }

  // Add custom skill
  const handleSaveCustomSkill = () => {
    if (!customSkill.label.trim()) return
    const newSkill: SkillPreset = {
      id: `custom-${Date.now()}`,
      label: customSkill.label.trim(),
      points: skillCategoryTab === 'positive' ? Math.abs(customSkill.points) || 1 : -Math.abs(customSkill.points) || -1,
      kind: skillCategoryTab,
      icon: customSkill.icon || (skillCategoryTab === 'positive' ? '⭐' : '⚠️'),
    }
    setSkills((prev) => [newSkill, ...prev])
    setCustomSkill({ label: '', points: 1, icon: '🌟' })
    setIsAddingCustomSkill(false)
  }

  const toggleStudentSelect = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-emerald-400/40 bg-slate-900/95 px-5 py-3 text-sm font-semibold text-emerald-300 shadow-[0_16px_40px_rgba(16,185,129,0.3)] backdrop-blur-xl animate-bounce">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Class Overview Card */}
      <div className="liquid-glass p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-3xl shadow-[0_12px_30px_rgba(245,158,11,0.35)]">
              🏆
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="chip-pill text-amber-300 border-amber-400/30">
                  Hệ thống ClassDojo
                </span>
                <span className="text-xs text-slate-400">• Sĩ số: {students.length} học sinh</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
                Điểm Thưởng & Kỷ Luật Lớp Học
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs uppercase tracking-wider text-slate-400">Tổng điểm cả lớp</span>
              <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400">
                {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleOpenAward({
                  type: 'class',
                  title: `Cả lớp (${students.length} HS)`,
                  studentIds: students.map((s) => s.id),
                })
              }
              className="soft-primary px-5 py-3 text-base shadow-[0_12px_28px_rgba(34,211,238,0.3)]"
            >
              <Award className="h-5 w-5" />
              <span>Thưởng cả lớp</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'students'
                  ? 'border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 shadow-[0_4px_20px_rgba(34,211,238,0.25)]'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Users className="h-4 w-4" />
              Học sinh ({students.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'groups'
                  ? 'border border-violet-400/50 bg-violet-500/20 text-violet-200 shadow-[0_4px_20px_rgba(168,85,247,0.25)]'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Nhóm học tập ({groups.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'history'
                  ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-[0_4px_20px_rgba(245,158,11,0.25)]'
                  : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <History className="h-4 w-4" />
              Lịch sử ghi điểm ({rewards.length})
            </button>
          </div>

          {activeTab === 'students' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMultiSelectMode((prev) => !prev)
                  setSelectedStudentIds([])
                }}
                className={`soft-secondary text-xs ${
                  isMultiSelectMode ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : ''
                }`}
              >
                {isMultiSelectMode ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" /> Thoát chọn nhiều
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" /> Chọn nhiều học sinh
                  </>
                )}
              </button>

              {isMultiSelectMode && (
                <>
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
                  <button
                    type="button"
                    disabled={selectedStudentIds.length === 0}
                    onClick={() =>
                      handleOpenAward({
                        type: 'students',
                        title: `${selectedStudentIds.length} học sinh`,
                        studentIds: selectedStudentIds,
                      })
                    }
                    className="soft-primary text-xs disabled:opacity-40"
                  >
                    Trao điểm ({selectedStudentIds.length})
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area based on Tab */}
      {activeTab === 'students' && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {students.map((student, index) => {
            const avatar = getMonsterAvatar(student.fullName, index)
            const pts = studentPointsMap.get(student.id) ?? 0
            const isSelected = selectedStudentIds.includes(student.id)

            return (
              <div
                key={student.id}
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleStudentSelect(student.id)
                  } else {
                    handleOpenAward({
                      type: 'student',
                      title: student.fullName,
                      studentId: student.id,
                    })
                  }
                }}
                className={`liquid-card relative flex flex-col items-center p-5 text-center cursor-pointer select-none transition-all duration-200 ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/50 shadow-[0_12px_32px_rgba(34,211,238,0.25)]'
                    : 'hover:scale-102 hover:border-white/25'
                }`}
              >
                {/* Checkbox overlay in multi-select mode */}
                {isMultiSelectMode && (
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400"
                    />
                  </div>
                )}

                {/* Monster Avatar */}
                <div
                  className={`relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${avatar.color} text-4xl shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-105`}
                >
                  <span>{avatar.face}</span>
                  {/* Point badge pill */}
                  <div
                    className={`absolute -bottom-2 -right-2 flex h-8 min-w-[32px] items-center justify-center rounded-full px-2 text-xs font-black shadow-lg border border-white/20 ${
                      pts >= 0
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950'
                        : 'bg-gradient-to-br from-rose-500 to-red-700 text-white'
                    }`}
                  >
                    {pts >= 0 ? `+${pts}` : pts}
                  </div>
                </div>

                {/* Student Info */}
                <h4 className="mt-4 font-bold text-slate-100 line-clamp-1">{student.fullName}</h4>
                <p className="mt-1 text-xs text-slate-400">
                  {pts} điểm tích lũy
                </p>

                {/* Quick Give Button */}
                <div className="mt-3 w-full">
                  <span className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-200">
                    {isMultiSelectMode ? (isSelected ? '✓ Đã chọn' : '+ Chọn') : '⚡ Trao điểm'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const gPts = groupPointsMap.get(group.id) ?? 0
            const memberNames = students
              .filter((s) => group.studentIds.includes(s.id))
              .map((s) => s.fullName)

            return (
              <div
                key={group.id}
                className="liquid-card flex flex-col justify-between p-5 transition-all hover:border-violet-400/40"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="chip-pill text-violet-300 border-violet-400/30">
                        Nhóm học tập
                      </span>
                      <h4 className="mt-2 text-lg font-bold text-white">{group.name}</h4>
                    </div>
                    <div
                      className={`flex h-10 min-w-[40px] items-center justify-center rounded-2xl px-2.5 text-sm font-extrabold shadow-md border border-white/20 ${
                        gPts >= 0
                          ? 'bg-gradient-to-br from-violet-400 to-purple-600 text-slate-950'
                          : 'bg-gradient-to-br from-rose-500 to-red-700 text-white'
                      }`}
                    >
                      {gPts >= 0 ? `+${gPts}` : gPts}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    {group.studentIds.length} thành viên:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {memberNames.slice(0, 6).map((name) => (
                      <span
                        key={name}
                        className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-300"
                      >
                        {name}
                      </span>
                    ))}
                    {memberNames.length > 6 && (
                      <span className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-0.5 text-[11px] text-slate-400">
                        +{memberNames.length - 6} bạn khác
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenAward({
                        type: 'group',
                        title: `Nhóm ${group.name}`,
                        groupId: group.id,
                        studentIds: group.studentIds,
                      })
                    }
                    className="soft-primary w-full text-xs font-bold"
                  >
                    ⚡ Trao điểm cho nhóm
                  </button>
                </div>
              </div>
            )
          })}
          {groups.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              Chưa có nhóm học tập nào. Bạn có thể sang mục <strong>Lớp học</strong> để tạo nhóm!
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="panel overflow-hidden">
          <div className="border-b border-white/10 p-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Nhật ký điểm thưởng & kỷ luật</h3>
            <span className="text-xs text-slate-400">Tổng cộng {rewards.length} lượt ghi nhận</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/70 text-slate-300">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Học sinh</th>
                  <th className="px-6 py-3.5 font-semibold">Hành vi / Kỹ năng</th>
                  <th className="px-6 py-3.5 font-semibold">Điểm số</th>
                  <th className="px-6 py-3.5 font-semibold">Thời gian</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rewards.map((reward) => {
                  const student = students.find((s) => s.id === reward.studentId)
                  return (
                    <tr key={reward.id} className="bg-slate-900/30 hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-medium text-white">
                        {student?.fullName ?? 'Học sinh không rõ'}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded-lg bg-white/5 px-2 py-1 text-xs">
                            {reward.type === 'points' ? 'Điểm' : reward.type}
                          </span>
                          <span>{reward.title}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-bold ${
                            reward.points >= 0
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {reward.points > 0 ? `+${reward.points}` : reward.points}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {reward.createdAt ? new Date(reward.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingReward(reward)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/10"
                            title="Sửa bản ghi"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Xóa ghi nhận "${reward.title}" của học sinh này?`)) {
                                void onDeleteReward(reward)
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 hover:border-rose-500/40 hover:bg-rose-500/15"
                            title="Xóa bản ghi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {rewards.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Chưa có ghi nhận điểm thưởng nào được lưu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ClassDojo Award Modal */}
      <Modal
        isOpen={isAwardModalOpen}
        onClose={() => setIsAwardModalOpen(false)}
        title={`Trao điểm cho ${awardTarget?.title || 'học sinh'}`}
        subtitle="Chọn kỹ năng tích cực hoặc nhắc nhở cần cố gắng"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Tabs: Tích cực vs Cần cố gắng */}
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-1.5">
            <button
              type="button"
              onClick={() => {
                setSkillCategoryTab('positive')
                setIsAddingCustomSkill(false)
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                skillCategoryTab === 'positive'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              Tích cực (Positive)
            </button>
            <button
              type="button"
              onClick={() => {
                setSkillCategoryTab('negative')
                setIsAddingCustomSkill(false)
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
                skillCategoryTab === 'negative'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              Cần cố gắng (Needs Work)
            </button>
          </div>

          {/* Grid of Skills */}
          {!isAddingCustomSkill ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 max-h-[380px] overflow-y-auto p-1">
              {skills
                .filter((s) => s.kind === skillCategoryTab)
                .map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => void handleGiveSkill(skill)}
                    className="group flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center transition hover:scale-102 hover:border-cyan-400/50 hover:bg-slate-800/60 hover:shadow-lg"
                  >
                    <span className="text-3xl transition group-hover:scale-110">{skill.icon}</span>
                    <span className="mt-2 text-xs font-bold text-slate-100">{skill.label}</span>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black ${
                        skill.points > 0
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {skill.points > 0 ? `+${skill.points}` : skill.points}
                    </span>
                  </button>
                ))}

              {/* Add Custom Skill Button */}
              <button
                type="button"
                onClick={() => setIsAddingCustomSkill(true)}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-slate-300 transition hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-200"
              >
                <Plus className="h-7 w-7 text-cyan-400" />
                <span className="mt-2 text-xs font-semibold">+ Thêm kỹ năng mới</span>
              </button>
            </div>
          ) : (
            /* Custom Skill Form */
            <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-4 space-y-3">
              <h4 className="text-sm font-bold text-white">
                Tạo kỹ năng mới ({skillCategoryTab === 'positive' ? 'Tích cực' : 'Cần cố gắng'})
              </h4>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_100px]">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Biểu tượng</label>
                  <input
                    type="text"
                    value={customSkill.icon}
                    onChange={(e) => setCustomSkill((prev) => ({ ...prev, icon: e.target.value }))}
                    className="input-shell w-14 text-center text-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tên hành vi / Kỹ năng</label>
                  <input
                    type="text"
                    value={customSkill.label}
                    onChange={(e) => setCustomSkill((prev) => ({ ...prev, label: e.target.value }))}
                    className="input-shell"
                    placeholder="Ví dụ: Giúp dọn dẹp lớp..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Số điểm</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customSkill.points}
                    onChange={(e) =>
                      setCustomSkill((prev) => ({ ...prev, points: Number(e.target.value) || 1 }))
                    }
                    className="input-shell"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCustomSkill(false)}
                  className="soft-secondary text-xs"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomSkill}
                  disabled={!customSkill.label.trim()}
                  className="soft-primary text-xs"
                >
                  Lưu kỹ năng
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Reward Record Modal */}
      <EditRewardModal
        reward={editingReward}
        isOpen={Boolean(editingReward)}
        onClose={() => setEditingReward(null)}
        onSave={async (rew, vals) => {
          await onUpdateReward(rew, vals)
          setEditingReward(null)
          showToast('✅ Đã cập nhật ghi nhận điểm!')
        }}
      />
    </div>
  )
}
