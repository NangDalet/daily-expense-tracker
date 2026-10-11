import { http, type QueryParams } from './client'
export interface Worker {
  id: string; workerCode: string; fullName: string; phone?: string; position: string
  rateType: 'DAILY' | 'HOURLY' | 'FIXED'; rate: number; overtimeRate: number; hoursPerDay: number
  currency: 'KHR'; startDate: string; active: boolean; photoDataUrl?: string
  projectId?: string | null; idCardDataUrl?: string | null; hasIdCard?: boolean
}
export interface Project { id: string; name: string; site: string; active: boolean }
export interface Attendance {
  id: string; workerId: string; projectId: string; workDate: string; kind: string; workdays: number
  hours: number; overtimeHours: number; baseWages: number; overtime: number; payrollId?: string
}
export interface Adjustment {
  id: string; workerId: string; kind: string; amount: number; adjustmentDate: string; reason: string
  status: string; createdBy: string; createdAt: string; approvedBy?: string; approvedAt?: string
  approvalReason?: string; payrollId?: string
}
export interface Payroll {
  id: string; reference: string; workerId: string; projectId: string; workerName: string; workerCode: string
  fromDate: string; toDate: string; period: string; currency: 'KHR'; rateType: string; rate: number
  workdays: number; hours: number; overtimeHours: number; baseWages: number; overtime: number
  bonuses: number; allowances: number; advances: number; deductions: number; netPay: number; paidAmount: number
  status: string; createdBy: string; createdAt: string; cancelledBy?: string; cancelledAt?: string; cancellationReason?: string
}
export interface Payment {
  id: string; payrollId: string; reference: string; requestKey: string; paymentDate: string
  amount: number; method: string; processedBy: string; processorName: string; createdAt: string
}
export type ConstructionRole = 'MANAGER' | 'FOREMAN'
export interface Grant { userId: string; username: string; fullName?: string; enabled: boolean; granted: boolean; constructionRole?: ConstructionRole; siteIds?: string[]; superAdmin?: boolean }
export interface PayrollRequest { workerId: string; projectId: string; fromDate: string; toDate: string; period: string }
const root = '/construction'
export const constructionApi = {
  access: () => http.get<{ allowed: boolean; superAdmin: boolean; manager?: boolean; constructionRole?: ConstructionRole; siteIds?: string[] }>(root + '/access'),
  grants: () => http.get<Grant[]>(root + '/grants'),
  grant: (id: string, granted: boolean, constructionRole: ConstructionRole = 'MANAGER', siteIds: string[] = []) => http.put(root + '/grants/' + id, { granted, constructionRole, siteIds }),
  workers: () => http.get<Worker[]>(root + '/workers'),
  worker: (id: string) => http.get<Worker>(root + '/workers/' + id),
  saveWorker: (body: unknown, id?: string) => id ? http.put<Worker>(root + '/workers/' + id, body) : http.post<Worker>(root + '/workers', body),
  projects: () => http.get<Project[]>(root + '/projects'),
  saveProject: (body: unknown, id?: string) => id ? http.put<Project>(root + '/projects/' + id, body) : http.post<Project>(root + '/projects', body),
  attendance: (filter: QueryParams) => http.get<Attendance[]>(root + '/attendance', filter),
  saveAttendance: (body: unknown, id?: string) => id ? http.put<Attendance>(root + '/attendance/' + id, body) : http.post<Attendance>(root + '/attendance', body),
  removeAttendance: (id: string) => http.delete(root + '/attendance/' + id),
  adjustments: () => http.get<Adjustment[]>(root + '/adjustments'),
  adjustment: (body: unknown) => http.post<Adjustment>(root + '/adjustments', body),
  approve: (id: string, approved: boolean, reason: string) => http.put(root + '/adjustments/' + id + '/approval', { approved, reason }),
  payrolls: (filter: QueryParams) => http.get<Payroll[]>(root + '/payrolls', filter),
  preview: (body: PayrollRequest) => http.post<Payroll>(root + '/payrolls/preview', body),
  payroll: (body: PayrollRequest) => http.post<Payroll>(root + '/payrolls', body),
  receipt: (id: string) => http.get<{ payroll: Payroll; payments: Payment[]; project: Project }>(root + '/payrolls/' + id + '/receipt'),
  cancel: (id: string, reason: string) => http.post<Payroll>(root + '/payrolls/' + id + '/cancel', { reason }),
  payments: (id: string) => http.get<Payment[]>(root + '/payrolls/' + id + '/payments'),
  pay: (id: string, body: unknown) => http.post<Payment>(root + '/payrolls/' + id + '/payments', body),
}
