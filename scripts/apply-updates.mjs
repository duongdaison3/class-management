import fs from 'fs'
import path from 'path'

const filePath = path.resolve('classroom-hub/src/App.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// Normalize line endings to LF for simple regex replacements, then restore CRLF
const isCRLF = content.includes('\r\n')
content = content.replace(/\r\n/g, '\n')

// 1. Add Lucide icons
content = content.replace(
  '  Wifi,\n  WifiOff,\n} from \'lucide-react\'',
  '  Wifi,\n  WifiOff,\n  Menu,\n  X,\n} from \'lucide-react\'\nimport {\n  EditSchoolModal,\n  EditClassModal,\n  EditStudentModal,\n  EditGroupModal,\n  EditAssignmentModal,\n} from \'./components/EditModals\'\nimport { StudentGradebook } from \'./components/StudentGradebook\'\nimport { ClassDojoRewards } from \'./components/ClassDojoRewards\'\nimport { EnhancedAttendance } from \'./components/EnhancedAttendance\''
)

// 2. Add isMobileMenuOpen state
content = content.replace(
  '  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)',
  '  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)'
)

// 3. Add Mobile Drawer before desktop sidebar
const mobileDrawerCode = `      <div className="app-shell min-h-screen bg-slate-950 text-slate-50">
        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col liquid-glass bg-slate-950/95 border-r border-white/15 p-4 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 shadow-md">
                    <GraduationCap className="h-5 w-5 text-slate-950" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Classroom</p>
                    <h2 className="text-lg font-bold text-white">Hub</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-4 flex flex-col gap-1.5">
                {navItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      \`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition \${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-cyan-200 border border-cyan-400/30 shadow-sm'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }\`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Trường đang chọn</p>
                  <select
                    value={effectiveSchoolId}
                    onChange={(event) => setSelectedSchoolId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-2.5 py-2 text-xs font-semibold text-white outline-none"
                  >
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </aside>
          </div>
        )}`

content = content.replace(
  '      <div className="app-shell min-h-screen bg-slate-950 text-slate-50">',
  mobileDrawerCode
)

// 4. Add hamburger menu button in Header
content = content.replace(
  '              <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">\n                <div>\n                  <p className="text-[10px] uppercase tracking-[0.26em] text-slate-400">Hệ thống quản lý lớp học</p>\n                  <h1 className="mt-1 text-2xl font-semibold text-white">{schoolName}</h1>\n                </div>',
  `              <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-8">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 md:hidden hover:bg-white/10 transition"
                    aria-label="Mở menu điều hướng"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-slate-400">Hệ thống quản lý lớp học</p>
                    <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-white truncate max-w-[200px] sm:max-w-none">{schoolName}</h1>
                  </div>
                </div>`
)

// 5. Update Routes to use EnhancedAttendance, StudentGradebook, ClassDojoRewards
content = content.replace(
  /<Route\s+path="\/attendance"\s+element=\{<AttendancePage[^>]+>\}\s*\/>/,
  '<Route path="/attendance" element={<EnhancedAttendance students={scopedStudents} attendance={scopedAttendance} onMarkAttendance={handleMarkAttendance} onBulkAttendance={handleBulkAttendance} />} />'
)

content = content.replace(
  /<Route\s+path="\/grading"\s+element=\{<GradingPage[^>]+>\}\s*\/>/,
  '<Route path="/grading" element={<StudentGradebook students={scopedStudents} assessments={scopedAssessments} onCreateAssessment={handleCreateAssessment} onUpdateAssessment={handleUpdateAssessment} onDeleteAssessment={handleDeleteAssessment} />} />'
)

content = content.replace(
  /<Route\s+path="\/rewards"\s+element=\{<RewardsPage[^>]+>\}\s*\/>/,
  '<Route path="/rewards" element={<ClassDojoRewards students={scopedStudents} rewards={scopedRewards} totalPoints={totalPoints} onAddReward={handleAddReward} onUpdateReward={handleUpdateReward} onDeleteReward={handleDeleteReward} groups={groups.filter((item) => item.classId === effectiveClassId)} />} />'
)

// 6. Update DashboardPage: replace window.prompt with EditSchoolModal
content = content.replace(
  'function DashboardPage({\n  students,\n  classes,',
  'function DashboardPage({\n  students,\n  classes,'
)

content = content.replace(
  `              <button type="button" className="soft-secondary flex-1" onClick={() => {
                const school = schools.find((item) => item.id === selectedSchoolId)
                if (!school) return
                const name = window.prompt('Tên trường', school.name)
                const address = window.prompt('Địa chỉ', school.address)
                if (name?.trim() && address?.trim()) void onUpdateSchool(school, { name: name.trim(), address: address.trim() })
              }}>Sửa</button>`,
  `              <button type="button" className="soft-secondary flex-1" onClick={() => {
                const school = schools.find((item) => item.id === selectedSchoolId)
                if (school) setEditingSchool(school)
              }}>Sửa</button>`
)

// Add editingSchool state and modal into DashboardPage
content = content.replace(
  '  const schoolForm = useForm<SchoolFormValues>({\n    resolver: zodResolver(schoolSchema),\n    defaultValues: {\n      name: \'\',\n      address: \'\',\n    },\n  })',
  '  const schoolForm = useForm<SchoolFormValues>({\n    resolver: zodResolver(schoolSchema),\n    defaultValues: {\n      name: \'\',\n      address: \'\',\n    },\n  })\n  const [editingSchool, setEditingSchool] = useState<School | null>(null)'
)

// Append modal to end of DashboardPage
content = content.replace(
  '        </div>\n      </div>\n    </div>\n  )\n}\n\nfunction StudentsPage',
  '        </div>\n      </div>\n      <EditSchoolModal school={editingSchool} isOpen={Boolean(editingSchool)} onClose={() => setEditingSchool(null)} onSave={onUpdateSchool} />\n    </div>\n  )\n}\n\nfunction StudentsPage'
)

// 7. Update StudentsPage: replace window.prompt with EditStudentModal
content = content.replace(
  '  const [bulkText, setBulkText] = useState(\'\')\n  const [bulkPreview, setBulkPreview] = useState<string[]>([])',
  '  const [bulkText, setBulkText] = useState(\'\')\n  const [bulkPreview, setBulkPreview] = useState<string[]>([])\n  const [editingStudent, setEditingStudent] = useState<Student | null>(null)'
)

content = content.replace(
  `                    <button type="button" className="text-cyan-300 hover:text-cyan-200" onClick={() => {
                      const fullName = window.prompt('Họ và tên', student.fullName)
                      const phone = window.prompt('Số điện thoại', student.phone)
                      const note = window.prompt('Ghi chú', student.note)
                      if (fullName?.trim() && phone !== null && note !== null) void onUpdateStudent(student as Student, { fullName: fullName.trim(), phone, note, classId: student.classId })
                    }}>Sửa</button>`,
  `                    <button type="button" className="text-cyan-300 hover:text-cyan-200" onClick={() => setEditingStudent(student as Student)}>Sửa</button>`
)

content = content.replace(
  '        </div>\n      </div>\n    </div>\n  )\n}\n\nfunction AttendancePage',
  '        </div>\n      </div>\n      <EditStudentModal student={editingStudent} isOpen={Boolean(editingStudent)} onClose={() => setEditingStudent(null)} onSave={onUpdateStudent} />\n    </div>\n  )\n}\n\nfunction AttendancePage'
)

// 8. Update ClassesPage: replace window.prompt for class & group with EditClassModal & EditGroupModal
content = content.replace(
  '  const [groupName, setGroupName] = useState(\'\')\n  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([])',
  '  const [groupName, setGroupName] = useState(\'\')\n  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([])\n  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null)\n  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null)'
)

content = content.replace(
  `                    <button type="button" className="mr-3 text-cyan-300" onClick={() => {
                      const name = window.prompt('Tên lớp', classItem.name)
                      const teacherName = window.prompt('Giáo viên', classItem.teacherName)
                      const room = window.prompt('Phòng học', classItem.room)
                      if (name?.trim() && teacherName?.trim() && room?.trim()) void onUpdateClass(classItem as ClassRoom, { name: name.trim(), teacherName: teacherName.trim(), room: room.trim() })
                    }}>Sửa</button>`,
  `                    <button type="button" className="mr-3 text-cyan-300" onClick={() => setEditingClass(classItem as ClassRoom)}>Sửa</button>`
)

content = content.replace(
  `                <button type="button" className="mr-3 text-cyan-200" onClick={() => {
                  const name = window.prompt('Tên nhóm', group.name)
                  if (name?.trim()) void onUpdateGroup(group, name.trim(), group.studentIds)
                }}>Sửa</button>`,
  `                <button type="button" className="mr-3 text-cyan-200" onClick={() => setEditingGroup(group)}>Sửa</button>`
)

content = content.replace(
  '        </div>\n      </div>\n    </div>\n  )\n}\n\nfunction GradingPage',
  '        </div>\n      </div>\n      <EditClassModal classItem={editingClass} isOpen={Boolean(editingClass)} onClose={() => setEditingClass(null)} onSave={onUpdateClass} />\n      <EditGroupModal group={editingGroup} students={students} isOpen={Boolean(editingGroup)} onClose={() => setEditingGroup(null)} onSave={onUpdateGroup} />\n    </div>\n  )\n}\n\nfunction GradingPage'
)

// 9. Update AssignmentsPage: replace window.prompt with EditAssignmentModal
content = content.replace(
  'function AssignmentsPage({\n  assignments,\n  onCreateAssignment,\n  onUpdateAssignment,\n  onDeleteAssignment,\n}: {\n  assignments: Array<{ id: string; title: string; description: string; dueDate: string; status: string }>\n  onCreateAssignment: (values: AssignmentFormValues) => Promise<void>\n  onUpdateAssignment: (assignment: Assignment, values: AssignmentFormValues) => Promise<void>\n  onDeleteAssignment: (assignment: Assignment) => Promise<void>\n}) {',
  'function AssignmentsPage({\n  assignments,\n  onCreateAssignment,\n  onUpdateAssignment,\n  onDeleteAssignment,\n}: {\n  assignments: Array<{ id: string; title: string; description: string; dueDate: string; status: string }>\n  onCreateAssignment: (values: AssignmentFormValues) => Promise<void>\n  onUpdateAssignment: (assignment: Assignment, values: AssignmentFormValues) => Promise<void>\n  onDeleteAssignment: (assignment: Assignment) => Promise<void>\n}) {\n  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)'
)

content = content.replace(
  `                <button type="button" className="mr-3 text-sm text-cyan-300" onClick={() => {
                  const title = window.prompt('Tên bài tập', assignment.title)
                  const description = window.prompt('Ghi chú', assignment.description)
                  const dueDate = window.prompt('Ngày dự kiến (YYYY-MM-DD)', assignment.dueDate)
                  const status = window.prompt('Trạng thái (todo/doing/done)', assignment.status)
                  if (title?.trim() && description !== null && dueDate?.trim() && status?.trim()) void onUpdateAssignment(assignment as Assignment, { title: title.trim(), description, dueDate: dueDate.trim(), status: status as AssignmentFormValues['status'] })
                }}>Sửa</button>`,
  `                <button type="button" className="mr-3 text-sm text-cyan-300" onClick={() => setEditingAssignment(assignment as Assignment)}>Sửa</button>`
)

content = content.replace(
  '        </form>\n      </div>\n    </div>\n  )\n}\n\nfunction ReportsPage',
  '        </form>\n      </div>\n      <EditAssignmentModal assignment={editingAssignment} isOpen={Boolean(editingAssignment)} onClose={() => setEditingAssignment(null)} onSave={onUpdateAssignment} />\n    </div>\n  )\n}\n\nfunction ReportsPage'
)

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated App.tsx!')
