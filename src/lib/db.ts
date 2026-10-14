import Dexie, { type Table } from 'dexie'
import { supabase } from './supabase'
import type {
  AppSetting,
  Assessment,
  Assignment,
  AttendanceRecord,
  ClassRoom,
  StudentGroup,
  Reward,
  School,
  Student,
  SyncQueueItem,
} from '../types'

class ClassroomHubDB extends Dexie {
  schools!: Table<School, string>
  classes!: Table<ClassRoom, string>
  groups!: Table<StudentGroup, string>
  students!: Table<Student, string>
  attendance!: Table<AttendanceRecord, string>
  rewards!: Table<Reward, string>
  assignments!: Table<Assignment, string>
  assessments!: Table<Assessment, string>
  syncQueue!: Table<SyncQueueItem, string>
  settings!: Table<AppSetting, string>

  constructor() {
    super('classroom-hub-db')

    this.version(1).stores({
      schools: '&id, ownerId, name',
      classes: '&id, schoolId, status, name',
      students: '&id, classId, fullName, status',
      attendance: '&id, classId, studentId, date, status',
      rewards: '&id, classId, studentId, type',
      assignments: '&id, classId, dueDate, status',
      assessments: '&id, classId, studentId, date',
      syncQueue: '&id, status, entityType, createdAt',
      settings: '&id, key',
    })

    this.version(2).stores({
      schools: '&id, ownerId, name, createdAt',
      classes: '&id, schoolId, status, name, createdAt',
      students: '&id, classId, fullName, status, createdAt',
      attendance: '&id, classId, studentId, date, status, createdAt',
      rewards: '&id, classId, studentId, type, createdAt',
      assignments: '&id, classId, dueDate, status, createdAt',
      assessments: '&id, classId, studentId, date, createdAt',
      syncQueue: '&id, status, entityType, createdAt',
      settings: '&id, key, updatedAt',
      groups: '&id, classId, name, createdAt',
    })
    this.version(3).stores({
      schools: '&id, ownerId, name, createdAt',
      classes: '&id, schoolId, status, name, createdAt',
      groups: '&id, classId, name, createdAt',
      students: '&id, classId, fullName, status, createdAt',
      attendance: '&id, classId, studentId, date, status, createdAt',
      rewards: '&id, classId, studentId, type, createdAt',
      assignments: '&id, classId, dueDate, status, createdAt',
      assessments: '&id, classId, studentId, date, createdAt',
      syncQueue: '&id, status, entityType, createdAt',
      settings: '&id, key, updatedAt',
    })
  }
}

export const db = new ClassroomHubDB()

const getRetryDelayMs = (retryCount: number) => {
  const cappedRetries = Math.min(Math.max(retryCount, 0), 6)
  return Math.min(2 ** cappedRetries * 2000, 60000)
}

const getNextRetryTime = (retryCount: number, lastAttemptedAt?: string) => {
  if (!lastAttemptedAt) {
    return 0
  }

  const delayMs = getRetryDelayMs(retryCount)
  return new Date(lastAttemptedAt).getTime() + delayMs
}

export const queueSyncOperation = async (
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operationType: SyncQueueItem['operationType'],
  payload: Record<string, unknown>,
) => {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    entityType,
    entityId,
    operationType,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    lastAttemptedAt: undefined,
    nextRetryAt: undefined,
  })
}

export const markSyncItemSynced = async (id: string) => {
  await db.syncQueue.update(id, {
    status: 'synced',
    retryCount: 0,
    nextRetryAt: undefined,
    lastError: undefined,
    lastAttemptedAt: new Date().toISOString(),
  })
}

export const setSyncItemFailed = async (id: string, error: string) => {
  const existing = await db.syncQueue.get(id)

  if (!existing) {
    return
  }

  const nextRetryCount = existing.retryCount + 1
  const timestamp = new Date().toISOString()

  await db.syncQueue.update(id, {
    status: 'failed',
    retryCount: nextRetryCount,
    lastError: error,
    lastAttemptedAt: timestamp,
    nextRetryAt: new Date(Date.now() + getRetryDelayMs(nextRetryCount)).toISOString(),
  })
}

const entityTables: Record<SyncQueueItem['entityType'], string> = {
  school: 'schools',
  student: 'students',
  attendance: 'attendance',
  reward: 'rewards',
  assessment: 'assessments',
  assignment: 'assignments',
  class: 'classes',
  group: 'groups',
}

const toRemotePayload = (entityType: SyncQueueItem['entityType'], payload: Record<string, unknown>) => {
  const fieldMap: Record<string, string> = {
    ownerId: 'owner_id',
    classId: 'class_id',
    schoolId: 'school_id',
    studentId: 'student_id',
    studentIds: 'student_ids',
    fullName: 'full_name',
    teacherName: 'teacher_name',
    dueDate: 'due_date',
    createdAt: 'created_at',
  }

  const remotePayload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    remotePayload[fieldMap[key] ?? key] = value
  }

  if (entityType === 'attendance' || entityType === 'assessment') {
    remotePayload.date = payload.date
  }

  return remotePayload
}

export const syncPendingQueue = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 0
  }

  if (!supabase) {
    return 0
  }

  const allQueueItems = await db.syncQueue.filter((item) => item.status === 'pending' || item.status === 'failed').toArray()
  const retryableItems = allQueueItems.filter((item) => {
    if (item.status === 'pending') {
      return true
    }

    const nextRetryAt = getNextRetryTime(item.retryCount, item.lastAttemptedAt)
    if (!nextRetryAt) {
      return true
    }

    return Date.now() >= nextRetryAt
  })

  if (retryableItems.length === 0) {
    return 0
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!sessionData.session) {
      return 0
    }

    let syncedCount = 0
    for (const item of retryableItems) {
      await db.syncQueue.update(item.id, {
        lastAttemptedAt: new Date().toISOString(),
      })

      const table = entityTables[item.entityType]
      const remotePayload = {
        id: item.entityId,
        ...toRemotePayload(item.entityType, item.payload),
      }

      if (item.operationType === 'delete') {
        const { error: deleteError } = await supabase.from(table).delete().eq('id', item.entityId)
        if (deleteError) {
          await setSyncItemFailed(item.id, deleteError.message)
          continue
        }
      } else {
        const { error: entityError } = await supabase.from(table).upsert(remotePayload, { onConflict: 'id' })
        if (entityError) {
          await setSyncItemFailed(item.id, entityError.message)
          continue
        }
      }

      const { error } = await supabase.from('sync_queue').upsert(
        {
          id: item.id,
          entity_type: item.entityType,
          entity_id: item.entityId,
          operation_type: item.operationType,
          payload: item.payload,
          created_at: item.createdAt,
          status: 'synced',
          retry_count: item.retryCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

      if (error) {
        await setSyncItemFailed(item.id, error.message)
        continue
      }

      await markSyncItemSynced(item.id)
      syncedCount += 1
    }

    return syncedCount
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể đồng bộ hàng đợi'
    for (const item of retryableItems) {
      await setSyncItemFailed(item.id, message)
    }
    return 0
  }
}
