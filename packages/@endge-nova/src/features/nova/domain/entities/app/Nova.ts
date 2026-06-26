import { NovaApp } from '@/features/nova/domain/entities/app/NovaApp'
import type { EventList } from '@/features/@utils/events/EventBus'

export class Nova {
  // Базовая конфигурация фаз 2д ядра
  static createApp<E extends EventList = Record<string, any>>(
    canvasId: string,
    predefinedEvents: (keyof E)[] = [],
  ): NovaApp<E> {
    return new NovaApp(canvasId, predefinedEvents)
  }
}
