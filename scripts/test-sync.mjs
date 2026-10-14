import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const envPath = new URL('../.env.local', import.meta.url)
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const publishableKey = env.VITE_SUPABASE_ANON_KEY
const secretKey = env.VITE_SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !publishableKey) {
  throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local.')
}

if (!secretKey) {
  throw new Error('Thiếu VITE_SUPABASE_SECRET_KEY hoặc SUPABASE_SECRET_KEY để test với service role.')
}

const anonClient = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const adminClient = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const schoolId = crypto.randomUUID()
const classId = crypto.randomUUID()
const studentId = crypto.randomUUID()

const { error: schoolError } = await adminClient.from('schools').insert({
  id: schoolId,
  owner_id: 'sync-test-user',
  name: 'Trường Test Sync',
  address: 'HCM',
})
if (schoolError) throw new Error(`Không thể insert schools: ${schoolError.message}`)

const { error: classError } = await adminClient.from('classes').insert({
  id: classId,
  school_id: schoolId,
  name: 'Lớp Test Sync',
  teacher_name: 'GV Test Sync',
  room: 'P999',
  status: 'active',
})
if (classError) throw new Error(`Không thể insert classes: ${classError.message}`)

const { error: studentError } = await adminClient.from('students').insert({
  id: studentId,
  class_id: classId,
  full_name: 'HS Test Sync',
  phone: '0900000000',
  status: 'active',
  note: 'Seed test sync',
})
if (studentError) throw new Error(`Không thể insert students: ${studentError.message}`)

const { data, error: selectError } = await adminClient
  .from('students')
  .select('id, full_name, class_id')
  .eq('id', studentId)
  .maybeSingle()

if (selectError) throw new Error(`Không thể đọc lại students: ${selectError.message}`)
if (!data) throw new Error('Không tìm thấy học sinh test vừa insert')

const { error: deleteStudentError } = await adminClient.from('students').delete().eq('id', studentId)
if (deleteStudentError) throw new Error(`Không thể xoá học sinh test: ${deleteStudentError.message}`)

const { error: deleteClassError } = await adminClient.from('classes').delete().eq('id', classId)
if (deleteClassError) throw new Error(`Không thể xoá lớp test: ${deleteClassError.message}`)

const { error: deleteSchoolError } = await adminClient.from('schools').delete().eq('id', schoolId)
if (deleteSchoolError) throw new Error(`Không thể xoá trường test: ${deleteSchoolError.message}`)

console.log('SYNC_TEST_OK')
console.log(JSON.stringify({ studentId: data.id, fullName: data.full_name, classId: data.class_id }, null, 2))

const { data: anonData, error: anonError } = await anonClient.from('schools').select('id').limit(1)
if (anonError) {
  console.warn('Anon read check failed:', anonError.message)
} else {
  console.log('ANON_READ_CHECK_OK', anonData.length)
}
