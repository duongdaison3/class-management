import { useState, useMemo } from 'react'
import {
  CheckCheck,
  Plus,
  Search,
  Filter,
  Calculator,
  Users,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react'
import { Modal } from './Modal'
import { EditAssessmentModal } from './EditModals'
import type { Assessment, Student } from '../types'

export const STANDARD_CATEGORIES = [
  { id: 'oral', label: 'Điểm kiểm tra miệng', short: 'Miệng', weight: 1, tone: 'from-amber-400 to-orange-500' },
  { id: 'notebook', label: 'Điểm chấm vở', short: 'Chấm vở', weight: 1, tone: 'from-sky-400 to-blue-500' },
  { id: '15min', label: 'Điểm kiểm tra 15 phút', short: '15 phút', weight: 1, tone: 'from-cyan-400 to-teal-500' },
  { id: 'practice', label: 'Điểm kiểm tra thực hành', short: 'Thực hành', weight: 1, tone: 'from-emerald-400 to-teal-500' },
  { id: '45min', label: 'Điểm kiểm tra 45 phút', short: '45 phút', weight: 2, tone: 'from-violet-400 to-indigo-500' },
  { id: 'midterm', label: 'Điểm kiểm tra Giữa kỳ I', short: 'Giữa kỳ I', weight: 2, tone: 'from-purple-400 to-fuchsia-500' },
  { id: 'final', label: 'Điểm kiểm tra Cuối kỳ 1', short: 'Cuối kỳ 1', weight: 3, tone: 'from-rose-400 to-pink-500' },
] as const

const getCategoryForAssessment = (title: string) => {
  const t = title.toLowerCase()
  if (t.includes('miệng') || t.includes('oral')) return 'oral'
  if (t.includes('vở') || t.includes('notebook')) return 'notebook'
  if (t.includes('thực hành') || t.includes('thuc hanh') || t.includes('practice')) return 'practice'
  if (t.includes('15') || t.includes('mười lăm')) return '15min'
  if (t.includes('45') || t.includes('bốn lăm') || t.includes('1 tiết')) return '45min'
  if (t.includes('giữa kỳ') || t.includes('giua ky')) return 'midterm'
  if (t.includes('cuối kỳ') || t.includes('cuoi ky') || t.includes('học kỳ')) return 'final'
  return '15min' // fallback
}

const getScoreColor = (score: number) => {
  if (score >= 8.0) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  if (score >= 6.5) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
  if (score >= 5.0) return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
}

const getRankLabel = (avg: number) => {
  if (avg >= 8.0) return { label: 'Giỏi', tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' }
  if (avg >= 6.5) return { label: 'Khá', tone: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30' }
  if (avg >= 5.0) return { label: 'Trung bình', tone: 'bg-amber-500/20 text-amber-300 border-amber-400/30' }
  return { label: 'Cần cố gắng', tone: 'bg-rose-500/20 text-rose-300 border-rose-400/30' }
}

interface StudentGradebookProps {
  students: Student[]
  assessments: Assessment[]
  onCreateAssessment: (values: { studentId: string; title: string; score: number; date: string }) => Promise<void>
  onUpdateAssessment: (assessment: Assessment, values: { studentId: string; title: string; score: number; date: string }) => Promise<void>
  onDeleteAssessment: (assessment: Assessment) => Promise<void>
}

export function StudentGradebook({
  students,
  assessments,
  onCreateAssessment,
  onUpdateAssessment,
  onDeleteAssessment,
}: StudentGradebookProps) {
  // Enabled category columns (by default show all categories including practice)
  const [activeCategoryIds, setActiveCategoryIds] = useState<string[]>([
    'oral',
    'notebook',
    '15min',
    'practice',
    '45min',
    'midterm',
    'final',
  ])

  const [searchQuery, setSearchQuery] = useState('')
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)

  // Quick single score entry modal
  const [isAddScoreOpen, setIsAddScoreOpen] = useState(false)
  const [newScoreData, setNewScoreData] = useState({
    studentId: '',
    categoryTitle: 'Điểm kiểm tra 15 phút',
    score: 8,
    date: new Date().toISOString().slice(0, 10),
  })

  // 1 score for multiple students modal (NEW)
  const [isMultiScoreModalOpen, setIsMultiScoreModalOpen] = useState(false)
  const [multiScoreCategory, setMultiScoreCategory] = useState('Điểm kiểm tra thực hành')
  const [multiScoreDate, setMultiScoreDate] = useState(new Date().toISOString().slice(0, 10))
  const [multiScoreValue, setMultiScoreValue] = useState<number>(8.5)
  const [selectedStudentIdsForMulti, setSelectedStudentIdsForMulti] = useState<string[]>([])
  const [multiStudentSearch, setMultiStudentSearch] = useState('')
  const [isSubmittingMulti, setIsSubmittingMulti] = useState(false)

  // Batch grade entry for whole class for a test column
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchCategory, setBatchCategory] = useState('Điểm kiểm tra 15 phút')
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10))
  const [batchScores, setBatchScores] = useState<Record<string, string>>({})
  const [batchQuickScore, setBatchQuickScore] = useState<string>('')
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter((s) => s.fullName.toLowerCase().includes(q))
  }, [students, searchQuery])

  // Filter students for multi-score modal
  const multiFilteredStudents = useMemo(() => {
    if (!multiStudentSearch.trim()) return students
    const q = multiStudentSearch.toLowerCase()
    return students.filter((s) => s.fullName.toLowerCase().includes(q))
  }, [students, multiStudentSearch])

  // Group assessments by student and category
  // For each category, find maximum number of attempts across all students to build dynamic sub-columns!
  const categoryMaxAttempts = useMemo(() => {
    const maxMap: Record<string, number> = {}
    for (const cat of STANDARD_CATEGORIES) {
      maxMap[cat.id] = 1 // At least 1 column
    }

    for (const s of students) {
      const studentAss = assessments.filter((a) => a.studentId === s.id)
      const countByCat: Record<string, number> = {}
      for (const a of studentAss) {
        const catId = getCategoryForAssessment(a.title)
        countByCat[catId] = (countByCat[catId] || 0) + 1
      }
      for (const cat of STANDARD_CATEGORIES) {
        if ((countByCat[cat.id] || 0) > maxMap[cat.id]) {
          maxMap[cat.id] = countByCat[cat.id]
        }
      }
    }
    return maxMap
  }, [students, assessments])

  // Map each student's assessments into slots for each category
  const studentCategoryAssessments = useMemo(() => {
    const map = new Map<string, Record<string, Assessment[]>>()

    for (const s of students) {
      const sMap: Record<string, Assessment[]> = {
        oral: [],
        notebook: [],
        '15min': [],
        practice: [],
        '45min': [],
        midterm: [],
        final: [],
      }
      const sAssessments = assessments
        .filter((a) => a.studentId === s.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      for (const a of sAssessments) {
        const catId = getCategoryForAssessment(a.title)
        if (sMap[catId]) {
          sMap[catId].push(a)
        }
      }
      map.set(s.id, sMap)
    }

    return map
  }, [students, assessments])

  // Calculate weighted GPA for each student
  const studentAverages = useMemo(() => {
    const map = new Map<string, { average: number | null; totalAssessments: number }>()

    for (const s of students) {
      const sMap = studentCategoryAssessments.get(s.id)
      if (!sMap) {
        map.set(s.id, { average: null, totalAssessments: 0 })
        continue
      }

      let totalWeightedScore = 0
      let totalWeight = 0
      let count = 0

      for (const cat of STANDARD_CATEGORIES) {
        const list = sMap[cat.id] || []
        for (const item of list) {
          totalWeightedScore += item.score * cat.weight
          totalWeight += cat.weight
          count += 1
        }
      }

      if (totalWeight > 0) {
        const avg = totalWeightedScore / totalWeight
        map.set(s.id, { average: Number(avg.toFixed(2)), totalAssessments: count })
      } else {
        map.set(s.id, { average: null, totalAssessments: 0 })
      }
    }

    return map
  }, [students, studentCategoryAssessments])

  const toggleCategory = (id: string) => {
    setActiveCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const toggleAllCategories = () => {
    if (activeCategoryIds.length === STANDARD_CATEGORIES.length) {
      setActiveCategoryIds([])
    } else {
      setActiveCategoryIds(STANDARD_CATEGORIES.map((c) => c.id))
    }
  }

  // Open add single score
  const handleOpenAddScore = (studentId?: string, categoryTitle?: string) => {
    setNewScoreData({
      studentId: studentId || (students[0]?.id ?? ''),
      categoryTitle: categoryTitle || 'Điểm kiểm tra 15 phút',
      score: 8,
      date: new Date().toISOString().slice(0, 10),
    })
    setIsAddScoreOpen(true)
  }

  const handleSaveSingleScore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newScoreData.studentId) return
    await onCreateAssessment({
      studentId: newScoreData.studentId,
      title: newScoreData.categoryTitle,
      score: Math.max(0, Math.min(10, Number(newScoreData.score))),
      date: newScoreData.date,
    })
    setIsAddScoreOpen(false)
  }

  // Open multi-student single score modal
  const handleOpenMultiScoreModal = (categoryTitle?: string) => {
    setMultiScoreCategory(categoryTitle || 'Điểm kiểm tra thực hành')
    setMultiScoreDate(new Date().toISOString().slice(0, 10))
    setMultiScoreValue(8.5)
    setSelectedStudentIdsForMulti(students.map((s) => s.id))
    setMultiStudentSearch('')
    setIsMultiScoreModalOpen(true)
  }

  const toggleStudentForMulti = (studentId: string) => {
    setSelectedStudentIdsForMulti((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    )
  }

  const handleSaveMultiScore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedStudentIdsForMulti.length === 0) return
    setIsSubmittingMulti(true)
    try {
      const score = Math.max(0, Math.min(10, Number(multiScoreValue)))
      await Promise.all(
        selectedStudentIdsForMulti.map((sId) =>
          onCreateAssessment({
            studentId: sId,
            title: multiScoreCategory,
            score,
            date: multiScoreDate,
          }),
        ),
      )
      setIsMultiScoreModalOpen(false)
    } finally {
      setIsSubmittingMulti(false)
    }
  }

  // Batch grade submit
  const handleOpenBatchModal = (catLabel: string) => {
    setBatchCategory(catLabel)
    setBatchDate(new Date().toISOString().slice(0, 10))
    setBatchScores({})
    setBatchQuickScore('')
    setIsBatchModalOpen(true)
  }

  const handleSaveBatchScores = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingBatch(true)
    try {
      const promises: Promise<void>[] = []
      for (const [sId, scoreVal] of Object.entries(batchScores)) {
        if (scoreVal !== undefined && scoreVal.trim() !== '') {
          const num = Number(scoreVal)
          if (!isNaN(num) && num >= 0 && num <= 10) {
            promises.push(
              onCreateAssessment({
                studentId: sId,
                title: batchCategory,
                score: num,
                date: batchDate,
              }),
            )
          }
        }
      }
      await Promise.all(promises)
      setIsBatchModalOpen(false)
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="liquid-glass p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="chip-pill text-cyan-300 border-cyan-400/30">
                Sổ theo dõi & Đánh giá
              </span>
              <span className="text-xs text-slate-400">• Sĩ số: {students.length} học sinh</span>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Bảng Điểm Học Sinh Chi Tiết
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Chọn các cột điểm để mở rộng. Điểm trung bình (ĐTB) tự động tính theo hệ số chuẩn (Miệng/Vở/15p/Thực hành: hs 1, 45p/Giữa kỳ: hs 2, Cuối kỳ: hs 3).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* New: 1 score for multiple students */}
            <button
              type="button"
              onClick={() => handleOpenMultiScoreModal('Điểm kiểm tra thực hành')}
              className="soft-primary px-4 py-2.5 shadow-[0_8px_20px_rgba(34,211,238,0.25)]"
            >
              <Users className="h-4 w-4" />
              <span>Nhập 1 điểm cho nhiều học sinh</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddScore()}
              className="soft-secondary"
            >
              <Plus className="h-4 w-4" />
              <span>Ghi điểm 1 học sinh</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenBatchModal('Điểm kiểm tra 15 phút')}
              className="soft-secondary"
            >
              <CheckCheck className="h-4 w-4 text-cyan-300" />
              <span>Nhập điểm cả lớp</span>
            </button>
          </div>
        </div>

        {/* Category Toggles and Search */}
        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
              <Filter className="h-3.5 w-3.5" />
              Cột điểm:
            </span>

            <button
              type="button"
              onClick={toggleAllCategories}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeCategoryIds.length === STANDARD_CATEGORIES.length
                  ? 'border border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {activeCategoryIds.length === STANDARD_CATEGORIES.length ? 'Ẩn tất cả' : 'Hiện tất cả'}
            </button>

            {STANDARD_CATEGORIES.map((cat) => {
              const isActive = activeCategoryIds.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'border border-white/20 bg-white/15 text-white shadow-sm ring-1 ring-cyan-400/30'
                      : 'border border-white/5 bg-slate-950/40 text-slate-400 hover:border-white/15 hover:text-slate-200'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${cat.tone}`} />
                  <span>{cat.label}</span>
                  <span className="text-[10px] text-slate-400 opacity-75">
                    (x{cat.weight})
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo tên học sinh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Main Gradebook Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-300">
              {/* Category Group Headers */}
              <tr className="divide-x divide-white/5 border-b border-white/10">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-slate-950/90 px-4 py-3 text-center text-xs font-bold text-slate-400 w-12"
                >
                  STT
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-12 z-20 bg-slate-950/90 px-4 py-3 font-bold text-white min-w-[190px]"
                >
                  Họ và tên học sinh
                </th>

                {STANDARD_CATEGORIES.filter((cat) => activeCategoryIds.includes(cat.id)).map(
                  (cat) => {
                    const attempts = categoryMaxAttempts[cat.id] || 1
                    return (
                      <th
                        key={cat.id}
                        colSpan={attempts}
                        className="px-4 py-2 text-center text-xs font-bold text-white bg-slate-900/60"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${cat.tone}`} />
                          <span>{cat.label}</span>
                          <span className="text-[10px] text-cyan-300 font-mono">(x{cat.weight})</span>
                          <button
                            type="button"
                            onClick={() => handleOpenMultiScoreModal(cat.label)}
                            title={`Nhập 1 điểm cho nhiều học sinh mục ${cat.label}`}
                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20"
                          >
                            <Users className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBatchModal(cat.label)}
                            title={`Nhập điểm cả lớp cho ${cat.label}`}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    )
                  },
                )}

                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-bold text-cyan-300 min-w-[100px] bg-slate-900/80"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Calculator className="h-4 w-4" />
                    <span>ĐTB</span>
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className="px-4 py-3 text-center font-bold text-slate-300 min-w-[110px] bg-slate-900/80"
                >
                  Xếp loại
                </th>
              </tr>

              {/* Sub-column Attempt Headers */}
              <tr className="divide-x divide-white/5 border-b border-white/10 text-[11px] text-slate-400">
                {STANDARD_CATEGORIES.filter((cat) => activeCategoryIds.includes(cat.id)).map(
                  (cat) => {
                    const attempts = categoryMaxAttempts[cat.id] || 1
                    return Array.from({ length: attempts }).map((_, idx) => (
                      <th
                        key={`${cat.id}-col-${idx}`}
                        className="px-3 py-1.5 text-center font-medium min-w-[65px] bg-slate-950/40"
                      >
                        Lần {idx + 1}
                      </th>
                    ))
                  },
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filteredStudents.map((student, sIdx) => {
                const sAssessments = studentCategoryAssessments.get(student.id) || {}
                const avgData = studentAverages.get(student.id)
                const rank = avgData?.average !== null && avgData?.average !== undefined ? getRankLabel(avgData.average) : null

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-800/30 transition-colors divide-x divide-white/5"
                  >
                    {/* STT */}
                    <td className="sticky left-0 z-10 bg-slate-950/90 px-4 py-3 text-center text-xs text-slate-400 font-mono">
                      {sIdx + 1}
                    </td>

                    {/* Student Full Name */}
                    <td className="sticky left-12 z-10 bg-slate-950/90 px-4 py-3 font-semibold text-white">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{student.fullName}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddScore(student.id)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-cyan-400 hover:underline ml-1"
                          title="Ghi thêm điểm cho học sinh này"
                        >
                          + Điểm
                        </button>
                      </div>
                    </td>

                    {/* Category score cells */}
                    {STANDARD_CATEGORIES.filter((cat) => activeCategoryIds.includes(cat.id)).map(
                      (cat) => {
                        const attempts = categoryMaxAttempts[cat.id] || 1
                        const studentCatScores = sAssessments[cat.id] || []

                        return Array.from({ length: attempts }).map((_, attemptIdx) => {
                          const item = studentCatScores[attemptIdx]

                          return (
                            <td
                              key={`${student.id}-${cat.id}-${attemptIdx}`}
                              className="px-2 py-2 text-center"
                            >
                              {item ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingAssessment(item)}
                                  className={`inline-flex items-center justify-center rounded-xl px-2.5 py-1 text-xs font-bold border transition transform hover:scale-110 shadow-sm ${getScoreColor(
                                    item.score,
                                  )}`}
                                  title={`${item.title} - ${item.date} (Bấm để sửa/xóa)`}
                                >
                                  {item.score.toFixed(1)}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddScore(student.id, cat.label)}
                                  className="h-7 w-7 rounded-lg border border-dashed border-white/10 text-slate-600 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 inline-flex items-center justify-center text-xs transition"
                                  title={`Thêm ${cat.label} cho ${student.fullName}`}
                                >
                                  +
                                </button>
                              )}
                            </td>
                          )
                        })
                      },
                    )}

                    {/* Điểm trung bình ĐTB */}
                    <td className="px-4 py-3 text-center bg-slate-950/30 font-bold">
                      {avgData?.average !== null && avgData?.average !== undefined ? (
                        <span
                          className={`inline-flex items-center justify-center rounded-xl px-2.5 py-1 text-sm font-extrabold border ${getScoreColor(
                            avgData.average,
                          )}`}
                        >
                          {avgData.average.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>

                    {/* Xếp loại */}
                    <td className="px-4 py-3 text-center bg-slate-950/30">
                      {rank ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${rank.tone}`}
                        >
                          {rank.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Chưa đủ điểm</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={20} className="py-12 text-center text-slate-400">
                    Không tìm thấy học sinh nào phù hợp với tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Add Single Score for 1 Student */}
      <Modal
        isOpen={isAddScoreOpen}
        onClose={() => setIsAddScoreOpen(false)}
        title="Ghi nhận điểm số mới"
        subtitle="Thêm điểm vào sổ theo dõi cho học sinh"
      >
        <form onSubmit={handleSaveSingleScore} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
              Học sinh *
            </label>
            <select
              value={newScoreData.studentId}
              onChange={(e) => setNewScoreData((prev) => ({ ...prev, studentId: e.target.value }))}
              className="input-shell"
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
              Mục kiểm tra / Tiêu chí *
            </label>
            <select
              value={newScoreData.categoryTitle}
              onChange={(e) =>
                setNewScoreData((prev) => ({ ...prev, categoryTitle: e.target.value }))
              }
              className="input-shell"
            >
              {STANDARD_CATEGORIES.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label} (Hệ số {c.weight})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
                Điểm số (0 - 10) *
              </label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={10}
                required
                value={newScoreData.score}
                onChange={(e) =>
                  setNewScoreData((prev) => ({ ...prev, score: Number(e.target.value) }))
                }
                className="input-shell text-lg font-bold text-cyan-300"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
                Ngày đánh giá
              </label>
              <input
                type="date"
                required
                value={newScoreData.date}
                onChange={(e) => setNewScoreData((prev) => ({ ...prev, date: e.target.value }))}
                className="input-shell"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsAddScoreOpen(false)}
              className="soft-secondary"
            >
              Hủy bỏ
            </button>
            <button type="submit" className="soft-primary">
              Lưu điểm
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: 1 Score for Multiple Students (NEW) */}
      <Modal
        isOpen={isMultiScoreModalOpen}
        onClose={() => setIsMultiScoreModalOpen(false)}
        title="Nhập 1 điểm cho nhiều học sinh"
        subtitle="Áp dụng cùng một mức điểm cho nhóm học sinh hoặc toàn bộ lớp"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveMultiScore} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
                Cột điểm / Tiêu chí *
              </label>
              <select
                value={multiScoreCategory}
                onChange={(e) => setMultiScoreCategory(e.target.value)}
                className="input-shell"
              >
                {STANDARD_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.label}>
                    {c.label} (Hệ số {c.weight})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
                Ngày đánh giá *
              </label>
              <input
                type="date"
                required
                value={multiScoreDate}
                onChange={(e) => setMultiScoreDate(e.target.value)}
                className="input-shell"
              />
            </div>
          </div>

          {/* Score input with quick presets */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-200">
                  Mức điểm áp dụng chung (0 - 10) *
                </label>
                <p className="text-[11px] text-slate-400">
                  Tất cả các học sinh được chọn bên dưới sẽ cùng nhận mức điểm này.
                </p>
              </div>
              <input
                type="number"
                step="0.1"
                min={0}
                max={10}
                required
                value={multiScoreValue}
                onChange={(e) => setMultiScoreValue(Number(e.target.value))}
                className="input-shell w-28 text-center text-xl font-extrabold text-cyan-300"
              />
            </div>

            {/* Quick score buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
              <span className="text-[11px] text-slate-400 mr-1">Chọn nhanh:</span>
              {[10, 9.5, 9.0, 8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMultiScoreValue(val)}
                  className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                    multiScoreValue === val
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/40 hover:text-white'
                  }`}
                >
                  {val.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Student selection panel */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-cyan-400" />
                Chọn học sinh nhận điểm ({selectedStudentIdsForMulti.length} / {students.length} đã chọn)
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudentIdsForMulti(students.map((s) => s.id))}
                  className="soft-ghost text-xs py-1 px-2.5"
                >
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIdsForMulti([])}
                  className="soft-ghost text-xs py-1 px-2.5"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Search filter for students */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm nhanh học sinh theo tên..."
                value={multiStudentSearch}
                onChange={(e) => setMultiStudentSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-1.5 pl-8 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            {/* Student checkboxes grid */}
            <div className="max-h-[240px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-3 space-y-1.5">
              <div className="grid gap-2 sm:grid-cols-2">
                {multiFilteredStudents.map((s) => {
                  const isChecked = selectedStudentIdsForMulti.includes(s.id)
                  return (
                    <label
                      key={s.id}
                      onClick={() => toggleStudentForMulti(s.id)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2 text-xs cursor-pointer select-none transition ${
                        isChecked
                          ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-sm'
                          : 'border-white/5 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled on parent label click
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span className="font-semibold truncate">{s.fullName}</span>
                    </label>
                  )
                })}
              </div>

              {multiFilteredStudents.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-500">
                  Không tìm thấy học sinh nào phù hợp.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-xs text-slate-400">
              Sẽ ghi <strong>{multiScoreValue.toFixed(1)}</strong> điểm cho <strong>{selectedStudentIdsForMulti.length}</strong> học sinh
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsMultiScoreModalOpen(false)}
                className="soft-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmittingMulti || selectedStudentIdsForMulti.length === 0}
                className="soft-primary disabled:opacity-40"
              >
                {isSubmittingMulti ? 'Đang lưu...' : `Lưu điểm (${selectedStudentIdsForMulti.length} HS)`}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Batch Grade Entry for Whole Class */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={`Nhập điểm cả lớp: ${batchCategory}`}
        subtitle="Nhập điểm nhanh danh sách học sinh cho cột điểm này"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveBatchScores} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
                Cột điểm
              </label>
              <select
                value={batchCategory}
                onChange={(e) => setBatchCategory(e.target.value)}
                className="input-shell"
              >
                {STANDARD_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.label}>
                    {c.label} (Hệ số {c.weight})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-300">
                Ngày đánh giá
              </label>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="input-shell"
              />
            </div>
          </div>

          {/* Quick bulk fill for all inputs */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              Gán nhanh cùng 1 mức điểm cho tất cả học sinh:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min={0}
                max={10}
                placeholder="0-10"
                value={batchQuickScore}
                onChange={(e) => setBatchQuickScore(e.target.value)}
                className="w-20 rounded-xl border border-white/15 bg-slate-900 px-2.5 py-1 text-center text-xs font-bold text-cyan-300 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (batchQuickScore !== '') {
                    const next: Record<string, string> = {}
                    for (const s of students) {
                      next[s.id] = batchQuickScore
                    }
                    setBatchScores(next)
                  }
                }}
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition"
              >
                Áp dụng cả lớp
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5"
                >
                  <span className="text-xs font-medium text-slate-200 truncate flex-1">
                    {student.fullName}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={10}
                    placeholder="0-10"
                    value={batchScores[student.id] ?? ''}
                    onChange={(e) =>
                      setBatchScores((prev) => ({ ...prev, [student.id]: e.target.value }))
                    }
                    className="w-16 rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-center text-xs font-bold text-cyan-300 outline-none focus:border-cyan-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(false)}
              className="soft-secondary"
            >
              Hủy bỏ
            </button>
            <button type="submit" disabled={isSubmittingBatch} className="soft-primary">
              {isSubmittingBatch ? 'Đang lưu...' : 'Lưu tất cả điểm'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Edit Existing Assessment Modal */}
      <EditAssessmentModal
        assessment={editingAssessment}
        students={students}
        isOpen={Boolean(editingAssessment)}
        onClose={() => setEditingAssessment(null)}
        onSave={async (ass, vals) => {
          await onUpdateAssessment(ass, vals)
          setEditingAssessment(null)
        }}
        onDelete={async (ass) => {
          await onDeleteAssessment(ass)
          setEditingAssessment(null)
        }}
      />
    </div>
  )
}
