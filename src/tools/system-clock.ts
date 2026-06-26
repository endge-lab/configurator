import { DateTime } from 'ts-luxon'

export const SystemClock = {
  DateTime,
  toDateTime(jsDate: Date) {
    return this.DateTime.fromJSDate(jsDate)
  },
  fromFormat(text: string, format: string, opts: any) {
    return this.DateTime.fromFormat(text, format, opts)
  },
  fromISO(text: string, opts: any = {}) {
    return text && this.DateTime.fromISO(text, { zone: 'utc', ...opts })
  },
  getNow() {
    return this.DateTime.now()
  },
  getNowUTC() {
    return this.DateTime.now().toUTC()
  },
  getToday() {
    return this.DateTime.now().startOf('day').toLocal()
  },
  getTime(fmt = 'HH:mm:ss') {
    return this.DateTime.now().toFormat(fmt)
  },
  getUTCTime(fmt = 'HH:mm:ss') {
    return this.DateTime.utc().toFormat(fmt)
  },
  getZone() {
    return this.DateTime.now().zone
  },
}

// window.DataModel = window.DataModel || {};
// window.DataModel.SystemClock = SystemClock;

export const dt = (date: Date) => {
  return SystemClock.toDateTime(date)
}

export const switchTimeZone = (datetime: DateTime) => {
  if (!DateTime.isDateTime(datetime)) {
    throw new TypeError(`${datetime} is not DateTime instance.`)
  }

  const { isLocalTime } = storeToRefs(useAppStore())
  if (isLocalTime.value) {
    return datetime.toUTC()
  }

  return datetime
}

export const toFormat = (datetime: DateTime, fmt: string, opts: any = {}) => {
  if (!DateTime.isDateTime(datetime)) {
    throw new TypeError(`${datetime} is not DateTime instance.`)
  }

  const { isLocalTime } = storeToRefs(useAppStore())
  if (isLocalTime.value) {
    return datetime.toLocal().toFormat(fmt, opts)
  }
  return datetime.toFormat(fmt, opts)
}
