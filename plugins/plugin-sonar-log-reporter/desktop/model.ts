export interface LogRecord {
  id: string
  logType: string
  timeStamp: Date
  message: string
  params?: Record<string, any>
}
