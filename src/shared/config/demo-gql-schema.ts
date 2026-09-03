const demoGqlSchema = `# This file was generated. Do not edit manually.

schema {
    query: Query
    mutation: Mutation
}

"Indicates a Bean Validation constraint"
directive @constraint(format: String, max: BigInteger, maxFloat: BigDecimal, maxLength: Int, min: BigInteger, minFloat: BigDecimal, minLength: Int, pattern: String) repeatable on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

"Indicates an Input Object is a OneOf Input Object."
directive @oneOf on INPUT_OBJECT

"Used to specify the role required to execute a given field or operation."
directive @rolesAllowed(value: String) on FIELD_DEFINITION

type AirportBaseParam {
    "IATA код аэропорта"
    code: String
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Имя аэропорта"
    name: String
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

type ConnectionAttribute {
    "Приоритет атрибута в порядке возрастания"
    actorPriority: Int
    "Логическое"
    bool: Boolean
    "Комментарий"
    comment: String
    "Id стыковки к которому привязана запись"
    connectionId: String
    """

    {
    "description": "Дата/Время",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    dateTime: DateTime
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Числовое значение"
    integer: Int
    "Список ссылок на медиа"
    links: [String]
    "Метаданные"
    meta: String
    "Имя типа атрибута к которому привязана запись"
    name: String
    "Приоритет источника"
    priority: Int
    "Время обработки ядром (ISO-8601)"
    processed: DateTime
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    "Текстовое значение"
    text: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Тип атрибута к которому привязана запись"
    type: String
}

type ConnectionCalculationProgram {
    id: String
    template: [ConnectionRouteElement]
}

type ConnectionColor {
    "Факт"
    actual: ConnectionGroup
    "Забронировано"
    booked: ConnectionGroup
    "Зарегистрировано"
    checkIn: ConnectionGroup
    "Цвет"
    color: ConnexColor
}

type ConnectionDTO {
    actualBaggage: ConnectionGroup
    actualBaggageWeight: ConnectionGroup
    actualPax: ConnectionGroup
    arrivalLeg: LegDTO
    arrivalLegId: String
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForConnection(names: [String]): [ConnectionAttribute]
    bntt: ConnectionTime
    bookedBaggage: ConnectionGroup
    bookedBaggageWeight: ConnectionGroup
    bookedPax: ConnectionGroup
    departureLeg: LegDTO
    departureLegId: String
    dest: AirportBaseParam
    diffBntt: Duration
    diffMct: Duration
    diffNtt: Duration
    id: String
    itemStatus: ItemStatus
    mct: ConnectionTime
    ntt: ConnectionTime
    orig: AirportBaseParam
    "Информация о перебронировании"
    rebookings: [Rebooking]
    station: String
    "Список назначенных управляющих воздействий"
    steeringActivities: [SteeringActivity]
}

type ConnectionGroup {
    "Бизнес класс"
    business: Int
    "Комфорт класс"
    comfort: Int
    "Комментарий"
    comment: String
    "Комплексное значение, пассажирский кластер"
    complex: String
    "Эконом класс"
    economy: Int
    "Пустая структура"
    empty: Boolean!
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Всего в кластере"
    total: Int
}

type ConnectionLegAggregate {
    "Всего пассажиров"
    actualPax: Int
    blueBagItems: ConnectionColor
    blueBagWeight: ConnectionColor
    bluePax: ConnectionColor
    "Всего пассажиров"
    bookedPax: Int
    grayBagItems: ConnectionColor
    grayBagWeight: ConnectionColor
    grayPax: ConnectionColor
    greenBagItems: ConnectionColor
    greenBagWeight: ConnectionColor
    greenPax: ConnectionColor
    "Всего проблемных пассажиров"
    issuedActualPax: Int
    "Всего проблемных пассажиров"
    issuedBookedPax: Int
    legId: String
    orangeBagItems: ConnectionColor
    orangeBagWeight: ConnectionColor
    orangePax: ConnectionColor
    redBagItems: ConnectionColor
    redBagWeight: ConnectionColor
    redPax: ConnectionColor
    yellowBagItems: ConnectionColor
    yellowBagWeight: ConnectionColor
    yellowPax: ConnectionColor
}

type ConnectionRoute {
    calculationProgram: ConnectionCalculationProgram
    totalDuration: Duration
}

type ConnectionRouteElement {
    averageSpeed: Int
    distance: Int
    duration: Duration
    endPoint: String
    order: Int
    startPoint: String
    type: String
    walkingConfigurationId: String
}

type ConnectionTime {
    "Расцветка для сравнения"
    color: ConnexColor
    "Комментарий"
    comment: String
    "Оценочное время на пересадку"
    estimated: Duration
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Требуемое время на пересадку"
    needed: Duration
    "Приоритет источника"
    priority: Int
    "Указывает была ли стыковка перебронирована"
    rebooked: Boolean!
    "Описание маршрута"
    route: ConnectionRoute
    "Описание расчета требуемого времени"
    routeRaw: String
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Тип"
    type: ConnexIssueType
}

type Delay {
    "Комментарий"
    comment: String
    "Id кода задержки"
    delayReasonCodeId: String
    "Длительность задержки"
    duration: Duration
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "IATA код задержки"
    iataCode: String
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Приоритет источника"
    priority: Int
    "Признак вины личного состава"
    responsible: Boolean!
    "Тип задержки"
    segment: DelaySegment
    "Подкод задержки"
    serviceCode: String
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

type GHItem {
    "Фактические значения"
    actual: GHOperation
    "Имя операции ТГО"
    code: String
    "Id плеча связанного с наземным обслуживанием"
    legId: String
    "Код аэропорта в котором выполняется наземное обслуживание"
    station: String
    "Плановые значения"
    target: GHOperation
}

type GHLeg {
    "Плечо прибытия"
    arrivalLeg: LegDTO
    "Плечо отправления"
    departureLeg: LegDTO
    "Признак что пара получена из списка приклееных"
    glued: Boolean
    "Id пары"
    id: String
}

type GHOperation {
    "Код операции"
    code: String
    "Порядковый номер операции наземного обслуживания"
    order: Int
    "Точки операции"
    points: [GHPoint]
}

type GHPoint {
    "Код точки процесса"
    code: String
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    links: [String]
    "Порядковый номер точки процесса"
    order: Int
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Значение точки процесса (ISO-8601)"
    value: DateTime
}

type GroundHandling {
    "Фактические значения"
    actual: GroundHandlingProcess
    "Id плана ТГО"
    id: String
    "Id плеча связанного с наземным обслуживанием"
    legId: String
    "Описание операции"
    operation: GroundHandlingOperation
    "Плановые значения"
    plan: GroundHandlingProcess
    "Код аэропорта в котором выполняется наземное обслуживание"
    station: String
    "Id аэропорта в котором выполняется наземное обслуживание"
    stationId: String
}

type GroundHandlingOperation {
    "Код операции"
    code: String
    "Признак важности операции"
    critical: Boolean
    "Id операции наземного обслуживания"
    id: String
    name: String
    shortName: String
    "Тип операции ТГО, процесс/мгновенная/группа..."
    type: GroundActivityType
}

type GroundHandlingPoint {
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Порядковый номер точки процесса"
    index: Int
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Порядковый номер точки процесса"
    name: String
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Значение точки процесса (ISO-8601)"
    value: DateTime
}

type GroundHandlingProcess {
    "Комментарий"
    comment: String
    "Завершение"
    end: GroundHandlingPoint
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Точки процесса"
    points: [GroundHandlingPoint]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "Начало"
    start: GroundHandlingPoint
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Тип ТГО прилет/с базы/прилет короткий/с базы короткий"
    type: ReferenceModelType
}

type HubNotification {
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Время формирования (ISO-8601)"
    generated: DateTime
    "Id записи"
    id: String
    "Плечо"
    leg: LegDTO
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Сообщение"
    message: String
    "Приоритет источника"
    priority: Int
    "Время обработки (ISO-8601)"
    processed: DateTime
    "Критичность"
    severity: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Время активности сообщения"
    ttl: Duration
    "Тип сообщения"
    type: String
    "Заголовок типа"
    typeTitle: String
    "Пользователь выполнивший обработку"
    user: HubNotificationUser
    "Id пользователя выполнившего обработку"
    userId: String
    "Пользователь выполнивший обработку"
    userName: String
}

type HubNotificationUser {
    "Логин пользователя"
    login: String
}

type LegAttribute {
    "Приоритет атрибута по возрастанию"
    actorPriority: Int
    "Логическое"
    bool: Boolean
    "Комментарий"
    comment: String
    """

    {
    "description": "Дата/Время",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    dateTime: DateTime
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Числовое значение"
    integer: Int
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Метаданные"
    meta: String
    "Имя типа атрибута к которому привязана запись"
    name: String
    "Приоритет источника"
    priority: Int
    "Время обработки ядром (ISO-8601)"
    processed: DateTime
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    "Текстовое значение"
    text: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Тип атрибута к которому привязана запись"
    type: String
}

type LegDTO {
    "Получение набора данных по стыковкам пассажиров для прилета"
    arrivalConnections: [ConnectionDTO]
    "Получение сводки по стыковкам пассажиров для прилета"
    arrivalConnectionsAggregate: ConnectionLegAggregate
    "Получение сводки по стыковкам пассажиров для прилета"
    arrivalMCTAggregate: ConnectionLegAggregate
    "Получение сводки по стыковкам пассажиров для прилета"
    arrivalNTTAggregate: ConnectionLegAggregate
    "Список назначенных управляющих воздействий по прилету"
    arrivalSteeringActivities: [SteeringActivity]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForArrivalLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForArrivalNextLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForArrivalPreviousLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForDepartureLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForDepartureNextLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForDeparturePreviousLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForNextLeg(names: [String]): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForPreviousLeg(names: [String]): [LegAttribute]
    "ISO-8601"
    cancelled: DateTime
    carrier: String
    "ISO-8601"
    date: DateTime
    "Получение набора задержек по прибытию для плеча по Id"
    delaysIn: [Delay]
    "Получение набора задержек по взлету для плеча по Id"
    delaysOff: [Delay]
    "Получение набора задержек по отправлению для плеча по Id"
    delaysOut: [Delay]
    "Получение набора данных по стыковкам пассажиров для вылета"
    departureConnections: [ConnectionDTO]
    "Получение сводки по стыковкам пассажиров для вылета"
    departureConnectionsAggregate: ConnectionLegAggregate
    "Получение сводки по стыковкам пассажиров для вылета"
    departureMCTAggregate: ConnectionLegAggregate
    "Получение сводки по стыковкам пассажиров для вылета"
    departureNTTAggregate: ConnectionLegAggregate
    "Список назначенных управляющих воздействий по вылету"
    departureSteeringActivities: [SteeringActivity]
    dest: AirportBaseParam
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "id_chain": {
    "attr_name": "codes"
    }
    }
    """
    ghArrivalItems(codes: [GroundHandlingCodeInputInput]): ListDTO
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "id_chain": {
    "attr_name": "codes"
    }
    }
    """
    ghDepartureItems(codes: [GroundHandlingCodeInputInput]): ListDTO
    glued: Boolean
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "display": {
    "inMenu":false,
    "title": "GroundHandlingArrival",
    "allElementListQuery":"groundhandlingList"
    },
    "id_chain": {
    "attr_name": "codes",
    "chain": "operation.code"
    }
    }
    """
    groundhandlingForArrival(codes: [String], stations: [String]): [GroundHandling]
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "display": {
    "inMenu":false,
    "title": "GroundHandlingDeparture",
    "allElementListQuery":"groundhandlingList"
    },
    "id_chain": {
    "attr_name": "codes",
    "chain": "operation.code"
    }
    }
    """
    groundhandlingForDeparture(codes: [String], stations: [String]): [GroundHandling]
    id: String
    idNext: String
    idPrevious: String
    itemStatus: ItemStatus
    "Признак отмены рейса"
    latestArrivalStationIataCode: String
    "ID а/п прибытия плеча"
    latestArrivalStationId: String
    latestDepartureStationIataCode: String
    "ID а/п отправления плеча"
    latestDepartureStationId: String
    number: String
    orig: AirportBaseParam
    "Получение SPI для одного плеча по Id"
    spiForLeg: [SpiRecord]
    "Получение SPI только транзитных для одного плеча по Id"
    spiTransitForLeg: [SpiRecord]
    suffix: String
}

type ListDTO {
    itemStatus: ItemStatus
    """

    {
    "description": "Элементы ТГО",
    "id_chain": {
    "chain": "code"
    }
    }
    """
    items: [GHItem]
    legId: String
    station: String
}

"Mutation root"
type Mutation {
    "Добавление информации по задержкам"
    addDelayInfo(data: DelayInputInput): Boolean
    "Изменение значения атрибута"
    changeAttribute(data: AttributeInputInput): Boolean
    "Изменение значения атрибута"
    changeConnexAttribute(data: AttributeInputInput): Boolean
    "Изменение статуса УВ"
    changeSAStatus(comment: String, id: String, newStatus: String): SteeringActivity
    "Изменение TOBT"
    changeTobt(data: TobtInputInput): Boolean
    "Удаление отметки времени"
    clearGHActual(data: GroundHandlingActualClearInput): Boolean
    "Добавление нескольких УВ"
    createBatchSA(newData: [HubSteeringActivityInputInput]): [SteeringActivity]
    "Добавление нового УВ"
    createSA(newData: HubSteeringActivityInputInput): SteeringActivity
    "Удаление информации по задержкам"
    deleteDelayInfo(delayId: String!): Boolean
    "Изменение статуса актуального списка уведомлений"
    processAllNotification(comment: String, interval: Int = 2): Boolean!
    "Изменение статуса уведомления"
    processNotification(comment: String, id: String): Boolean!
    "Перебронирование стыковки"
    rebookPassengers(newRebooking: RebookingInputInput): Rebooking
    "Ввод отметки времени"
    typeActualTimestamp(newTs: ActualTimestampInputInput): Boolean
    "Ввод отметки времени"
    typeGHActual(newTs: GroundHandlingActualInputInput): Boolean
}

type Passenger {
    "Получение набора данных по стыковкам пассажиров для прилета"
    arrivalConnectionsForPax: ConnectionDTO
    "Багаж пассажира"
    baggage: PassengerBaggage
    "Описание брони"
    booking: PassengerBooking
    "Получение информации по текущему рейсу пассажирской брони"
    currentLeg: LegDTO
    currentLegId: String
    "Получение набора данных по стыковкам пассажиров для вылета"
    departureConnectionsForPax: ConnectionDTO
    "Id"
    id: String
    "Id рейса к которому привязан пассажир"
    legId: String
    "Получение информации по следующему рейсу пассажирской брони"
    nextLeg: LegDTO
    nextLegId: String
    "Получение информации по следующим пассажирским броням"
    nextPax: Passenger
    "Получение информации по следующим пассажирским броням"
    paxHistory: Passenger
    "Имя пассажира"
    paxName: PassengerName
    "Получение информации по предыдущему рейсу пассажирской брони"
    previousLeg: LegDTO
    previousLegId: String
    "Получение информации по следующим пассажирским броням"
    previousPax: Passenger
    rebooked: Boolean!
    "Информация о перебронировании"
    rebooking: Rebooking
    "Кресла занимаемые пассажиром"
    seats: PassengerSeats
    "Spi"
    spiForPax: [SpiRecord]
    status: String
}

type PassengerBaggage {
    "Комментарий"
    comment: String
    "Количество мест багажа"
    count: Int
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    "Багажные бирки"
    tags: [String]
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Вес багажа"
    weight: Int
}

type PassengerBooking {
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Класс обслуживания"
    paxClass: String
    "Код бронирования"
    pnr: String
    "Приоритет источника"
    priority: Int
    "Подкласс"
    serviceClass: String
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    "Статус пассажира"
    status: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

type PassengerName {
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Полное имя"
    name: String
    "Имя пассажира"
    names: [PassengerNameStruct]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

type PassengerNameStruct {
    "Имя пассажира"
    name: String
    nameRu: String
    "Фамилия пассажира"
    surname: String
    surnameRu: String
}

type PassengerSeats {
    "Комментарий"
    comment: String
    "Количество кресел"
    count: Int
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Кресла"
    numbers: [String]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

"Query root"
type Query {
    """

    {
    "description": "Получение всех плечей с данными",
    "display": {
    "inMenu":true,
    "title": "Flights",
    }
    }
    """
    allLegs(colorFilters: [FilterFieldInput], filter: LegFilterInput, gluedLegExclude: Boolean = false, gluedLegs: [String], legId: String, order: OrderFieldInput, pageIndex: Int = 0, pageSize: Int = 10000): [LegDTO]
    "Получение набора данных по стыковкам пассажиров для прилета (IssueType фильтр проблемных с опциями EMPTY/NTT/MCT/bNTT)"
    arrivalConnections(colorFilters: [FilterFieldInput], durationFilters: [FilterFieldInput], filterArrival: LegFilterInput, issueType: String = "EMPTY", legId: String, order: OrderFieldInput, pageIndex: Int = 0, pageSize: Int = 10000, station: FilterFieldInput): [ConnectionDTO]
    "Получение набора данных по стыковкам пассажиров для прилета"
    arrivalConnectionsForPax(paxes: [PassengerDTOInput]): [ConnectionDTO]
    "Получение списка пассажирcких броней для прилетной стыковки"
    arrivalPaxForConnection(arrivalLegId: String, departureLegId: String): [Passenger]
    "Список назначенных управляющих воздействий по прилету"
    arrivalSteeringActivities(legs: [LegDTOInput]): [[SteeringActivity]]
    "Получение списка истории изменения атрибута"
    attributeHistory(legId: String, name: String): [LegAttribute]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForArrivalLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForArrivalNextLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForArrivalPreviousLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForConnection(connections: [ConnectionDTOInput], names: [String]): [[ConnectionAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForDepartureLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForDepartureNextLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForDeparturePreviousLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForNextLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    """

    {
    "description": "Получение набора атрибутов по списку имен для одного плеча внутри выборки, с актуальными значениями",
    "display": {
    "inMenu":false,
    "title": "LegAttributes",
    "allElementListQuery":"attributeList"
    },
    "id_chain": {
    "attr_name": "names",
    "chain": "name"
    }
    }
    """
    attributesForPreviousLeg(legs: [LegDTOInput], names: [String]): [[LegAttribute]]
    "Получение информации по текущему рейсу пассажирской брони"
    currentLeg(paxes: [PassengerDTOInput]): [LegDTO]
    "Получение набора задержек по прибытию для плеча по Id"
    delaysIn(legs: [LegDTOInput]): [[Delay]]
    "Получение набора задержек по взлету для плеча по Id"
    delaysOff(legs: [LegDTOInput]): [[Delay]]
    "Получение набора задержек по отправлению для плеча по Id"
    delaysOut(legs: [LegDTOInput]): [[Delay]]
    "Получение набора данных по стыковкам пассажиров для вылета (IssueType фильтр проблемных с опциями EMPTY/NTT/MCT/bNTT)"
    departureConnections(colorFilters: [FilterFieldInput], durationFilters: [FilterFieldInput], filterDeparture: LegFilterInput, issueType: String = "EMPTY", legId: String, order: OrderFieldInput, pageIndex: Int = 0, pageSize: Int = 10000, station: FilterFieldInput): [ConnectionDTO]
    "Получение набора данных по стыковкам пассажиров для вылета"
    departureConnectionsForPax(paxes: [PassengerDTOInput]): [ConnectionDTO]
    "Получение списка пассажирcких броней для вылетной стыковки"
    departurePaxForConnection(arrivalLegId: String, departureLegId: String): [Passenger]
    "Список назначенных управляющих воздействий по вылету"
    departureSteeringActivities(legs: [LegDTOInput]): [[SteeringActivity]]
    "Получение двух плечей с данными по Id прилетного"
    getGroundConnectedLegsForArrival(legId: String): GHLeg
    "Получение двух плечей с данными по Id вылетного"
    getGroundConnectedLegsForDeparture(legId: String): GHLeg
    "Получение списка пар плечей"
    getListGroundConnectedLegsForArrival(filterArrival: LegFilterInput, filterDeparture: LegFilterInput, gluedLegExclude: Boolean = false, gluedLegs: [String], legId: String, order: OrderFieldInput, pageIndex: Int = 0, pageSize: Int = 25): [GHLeg]
    "Получение списка пар плечей"
    getListGroundConnectedLegsForDeparture(filterArrival: LegFilterInput, filterDeparture: LegFilterInput, gluedLegExclude: Boolean = false, gluedLegs: [String], legId: String, order: OrderFieldInput, pageIndex: Int = 0, pageSize: Int = 25): [GHLeg]
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "id_chain": {
    "attr_name": "codes"
    }
    }
    """
    ghArrivalItems(codes: [GroundHandlingCodeInputInput], legs: [LegDTOInput]): [ListDTO]
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "id_chain": {
    "attr_name": "codes"
    }
    }
    """
    ghDepartureItems(codes: [GroundHandlingCodeInputInput], legs: [LegDTOInput]): [ListDTO]
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "display": {
    "inMenu":false,
    "title": "GroundHandlingArrival",
    "allElementListQuery":"groundhandlingList"
    },
    "id_chain": {
    "attr_name": "codes",
    "chain": "operation.code"
    }
    }
    """
    groundhandlingForArrival(codes: [String], leg: LegDTOInput, stations: [String]): [GroundHandling]
    """

    {
    "description": "Получение набора операций наземного обслуживания, по списку имен, с плановыми и фактическими значениями",
    "display": {
    "inMenu":false,
    "title": "GroundHandlingDeparture",
    "allElementListQuery":"groundhandlingList"
    },
    "id_chain": {
    "attr_name": "codes",
    "chain": "operation.code"
    }
    }
    """
    groundhandlingForDeparture(codes: [String], leg: LegDTOInput, stations: [String]): [GroundHandling]
    "Получение списка операций для оформления колонок"
    groundhandlingList(codes: [String]): [GroundHandlingOperation]
    "Получение информации по следующему рейсу пассажирской брони"
    nextLeg(paxes: [PassengerDTOInput]): [LegDTO]
    "Получение информации по следующим пассажирским броням"
    nextPax(paxes: [PassengerDTOInput]): [Passenger]
    "Получение уведомлений для пользователя"
    notifications(interval: Int = 2, pageIndex: Int = 0, pageSize: Int = 5, stations: [String] = ["SVO"]): [HubNotification]
    "Признак что заказ сделан текущим пользователем"
    owned(dto: HubSteeringActivityDTOInput): Boolean!
    "Получение списка пассажиров для прилетной стыковки по ID"
    paxForArrivalConnectionByIds(arrivalLegId: String, departureLegId: String): [Passenger]
    "Получение списка пассажиров для вылетной стыковки по ID"
    paxForDepartureConnectionByIds(arrivalLegId: String, departureLegId: String): [Passenger]
    "Получение информации по следующим пассажирским броням"
    paxHistory(paxes: [PassengerDTOInput]): [Passenger]
    "Получение информации по предыдущему рейсу пассажирской брони"
    previousLeg(paxes: [PassengerDTOInput]): [LegDTO]
    "Получение информации по следующим пассажирским броням"
    previousPax(paxes: [PassengerDTOInput]): [Passenger]
    "Информация о перебронировании"
    rebooking(pax: PassengerDTOInput): Rebooking
    "Получение вариантов для перебронирования"
    rebookingOptions(hourFrom: Int = 2, hourTo: Int = 48, legId: String, order: OrderFieldInput, pageIndex: Int = 0, pageSize: Int = 10): [LegDTO]
    "Информация о перебронировании"
    rebookings(connection: ConnectionDTOInput): [Rebooking]
    "Получение плеча с данными по Id"
    singleLeg(legId: String): LegDTO
    "Получение SPI для одного плеча по Id"
    spiForLeg(leg: LegDTOInput): [SpiRecord]
    "Получение SPI только транзитных для одного плеча по Id"
    spiTransitForLeg(leg: LegDTOInput): [SpiRecord]
    "Список назначенных управляющих воздействий"
    steeringActivities(connections: [ConnectionDTOInput]): [[SteeringActivity]]
    "Получение всех УВ доступных для пользователя"
    steeringActivitiesList(interval: Int = 2, pageIndex: Int = 0, pageSize: Int = 5): [SteeringActivity]
}

type Rebooking {
    "Комментарий"
    comment: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Приоритет источника"
    priority: Int
    rebookedPaxCount: Int
    "Источник"
    source: String
    sourceConnectionId: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    targetDepartureLegId: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    userName: String
}

type SpiRecord {
    "Комментарий"
    comment: String
    count: BigInteger
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    name: String
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

type SteeringActivity {
    "Id плеча рейса"
    arrivalLegId: String
    "Тип УВ"
    code: String
    "Комментарий"
    comment: String
    "Id стыковки"
    connectionId: String
    "Id плеча рейса"
    departureLegId: String
    "Признак что значение было сформировано недавно, не ранее чем 10 минут назад"
    fresh: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Время формирования (ISO-8601)"
    ordered: DateTime
    "Признак что заказ сделан текущим пользователем"
    owned: Boolean!
    "Имя пользователя создавшего УВ"
    owner: String
    "Приоритет источника"
    priority: Int
    "Код роли на которую назначен УВ"
    role: String
    "Источник"
    source: String
    station: String
    "Статус УВ"
    status: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

enum ConnexColor {
    BLUE
    GRAY
    GREEN
    NONE
    ORANGE
    RED
    YELLOW
}

enum ConnexIssueType {
    EMPTY
    MCT
    NTT
    bNTT
}

enum DelaySegment {
    In
    Off
    Out
    Unk
}

enum GroundActivityType {
    G
    I
    P
    V
}

enum ItemStatus {
    ADD
    REMOVE
    UNK
    UPDATE
}

enum ReferenceModelType {
    AC
    I
    IS
    O
    OS
    T
}

"Scalar for BigDecimal"
scalar BigDecimal

"Scalar for BigInteger"
scalar BigInteger

"Scalar for DateTime"
scalar DateTime

"Scalar for Duration"
scalar Duration

input ActualTimestampInputInput {
    activityId: String!
    comment: String
    legId: String!
    station: String
    stationId: String
    type: GroundActivityType!
    "ISO-8601"
    valueEnd: DateTime
    "ISO-8601"
    valueStart: DateTime
}

input AirportDTOInput {
    "IATA код аэропорта"
    code: String
    "Комментарий"
    comment: String
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Имя аэропорта"
    name: String
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

input AttributeInputInput {
    "Логическое"
    bool: Boolean
    "Дата/Время (ISO-8601)"
    dateTimeValue: DateTime
    "Числовое значение"
    integerValue: Int
    "Id плеча к которому привязана запись"
    legId: String!
    "Метаданные"
    meta: String
    "Имя атрибута к которому привязана запись"
    name: String!
    "Время обработки ядром (ISO-8601)"
    processed: DateTime
    "Текстовое значение"
    textValue: String
}

input ConnectionDTOInput {
    actualBaggage: ConnectionGroupDTOInput
    actualBaggageWeight: ConnectionGroupDTOInput
    actualPax: ConnectionGroupDTOInput
    arrivalLeg: LegDTOInput
    arrivalLegId: String
    bntt: ConnectionTimeDTOInput
    bookedBaggage: ConnectionGroupDTOInput
    bookedBaggageWeight: ConnectionGroupDTOInput
    bookedPax: ConnectionGroupDTOInput
    departureLeg: LegDTOInput
    departureLegId: String
    dest: AirportDTOInput
    diffBntt: Duration
    diffMct: Duration
    diffNtt: Duration
    id: String
    itemStatus: ItemStatus
    mct: ConnectionTimeDTOInput
    ntt: ConnectionTimeDTOInput
    orig: AirportDTOInput
    rebookingId: String
    spiArrivalList: [SpiRecordDTOInput]
    spiDepartureList: [SpiRecordDTOInput]
    spiList: [SpiRecordDTOInput]
    station: String
}

input ConnectionGroupDTOInput {
    "Бизнес класс"
    business: Int
    "Комфорт класс"
    comfort: Int
    "Комментарий"
    comment: String
    "Комплексное значение, пассажирский кластер"
    complex: String
    "Эконом класс"
    economy: Int
    "Пустая структура"
    empty: Boolean!
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Всего в кластере"
    total: Int
}

input ConnectionTimeDTOInput {
    "Расцветка для сравнения"
    color: ConnexColor
    "Комментарий"
    comment: String
    "Оценочное время на пересадку"
    estimated: Duration
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Требуемое время на пересадку"
    needed: Duration
    "Приоритет источника"
    priority: Int
    "Указывает была ли стыковка перебронирована"
    rebooked: Boolean!
    "Описание расчета требуемого времени"
    routeRaw: String
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Тип"
    type: ConnexIssueType
}

input DelayInputInput {
    delayCodeId: String!
    legId: String!
    remark: String
    segment: String!
    stationId: String
    value: Duration!
}

input FieldConditionInput {
    and: String
    andUnit: String
    attributeA: String
    attributeB: String
    compareOperation: String
    conditions: [FieldConditionInput]
    linkType: String
    list: [String]
    operator: String
    type: String
    value: String
    valuePath: String
    valueType: String
    valueUnit: String
}

input FilterFieldInput {
    "Второе значение для сравнения в диапазоне"
    and: String
    "Единицы времени для оконного сравнения"
    andUnit: String
    "Имя атрибута"
    attribute: String
    "Значения для сравнения"
    list: [String]
    "Оператор для сравнения выборки, варианты, lt/le/gt/ge/eq/between/endsWith/startsWith/contains/plus/minus"
    operator: String
    "Маршрут: Arrival/Departure"
    route: String
    """

    Тип значения integer/string/uuid/timestamp/window
    timestamp - YYYY-MM-DDTHH24:MI:SS
    window - целочисленное от INTEGER часов до текущего времени и до INTEGER часов до текущего времени
    """
    type: String
    "Значение для сравнения"
    value: String
    "Единицы времени для оконного сравнения"
    valueUnit: String
}

input GroundHandlingActualClearInput {
    code: String!
    legId: String!
    point: String!
    station: String!
}

input GroundHandlingActualInputInput {
    code: String!
    comment: String
    legId: String!
    point: String!
    station: String!
    "ISO-8601"
    value: DateTime!
}

input GroundHandlingCodeInputInput {
    code: String!
    points: [String]
}

input HubSteeringActivityDTOInput {
    "Id плеча рейса"
    arrivalLegId: String
    "Тип УВ"
    code: String
    "Комментарий"
    comment: String
    "Id стыковки"
    connectionId: String
    "Id плеча рейса"
    departureLegId: String
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Время формирования (ISO-8601)"
    ordered: DateTime
    "Имя пользователя создавшего УВ"
    owner: String
    "Приоритет источника"
    priority: Int
    "Код роли на которую назначен УВ"
    role: String
    "Источник"
    source: String
    station: String
    "Статус УВ"
    status: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

input HubSteeringActivityInputInput {
    area: String!
    arrivalLegId: String
    arrivalStation: String
    code: String!
    comment: String
    connectionId: String
    departureLegId: String
    departureStation: String
    legId: String
    passengerList: [String]
    station: String
}

input LegDTOInput {
    "ISO-8601"
    cancelled: DateTime
    carrier: String
    "ISO-8601"
    date: DateTime
    dest: AirportDTOInput
    glued: Boolean
    id: String
    idNext: String
    idPrevious: String
    itemStatus: ItemStatus
    "Признак отмены рейса"
    latestArrivalStationIataCode: String
    "ID а/п прибытия плеча"
    latestArrivalStationId: String
    latestDepartureStationIataCode: String
    "ID а/п отправления плеча"
    latestDepartureStationId: String
    number: String
    orig: AirportDTOInput
    suffix: String
}

"Фильтр данных"
input LegFilterInput {
    "Тип ВС"
    aircraftType: FilterFieldInput
    "Код авиакомпании"
    airlineCode: FilterFieldInput
    "Гейт прибытия"
    arrivalGate: FilterFieldInput
    "Стоянка прибытия"
    arrivalParkingStand: FilterFieldInput
    "Стоянка прибытия"
    arrivalPosition: FilterFieldInput
    "Терминал прибытия"
    arrivalTerminal: FilterFieldInput
    "Наилучшее время отправления"
    bestOffBlockTimestamp: FilterFieldInput
    "Наилучшее время прибытие"
    bestOnBlockTimestamp: FilterFieldInput
    "Гейт отправления"
    departureGate: FilterFieldInput
    "Стоянка отправления"
    departureParkingStand: FilterFieldInput
    "Стоянка отправления"
    departurePosition: FilterFieldInput
    "Терминал отправления"
    departureTerminal: FilterFieldInput
    "Гибкая система фильтрации полей"
    flexibleFilter: FieldConditionInput
    "Номер рейса"
    flightNumber: FilterFieldInput
    "Наличие проблемных транзитов по bNTT для прилета"
    hasArrivalBNTTProblem: FilterFieldInput
    "Наличие проблемных транзитов по MCT для прилета"
    hasArrivalMCTProblem: FilterFieldInput
    "Наличие проблемных транзитов по NTT для прилета"
    hasArrivalNTTProblem: FilterFieldInput
    "Наличие атрибута с определенным значением"
    hasAttributeTextValue: FilterFieldInput
    "Наличие задержек"
    hasDelays: FilterFieldInput
    "Наличие проблемных транзитов по bNTT для вылета"
    hasDepartureBNTTProblem: FilterFieldInput
    "Наличие проблемных транзитов по MCT для вылета"
    hasDepartureMCTProblem: FilterFieldInput
    "Наличие проблемных транзитов по NTT для вылета"
    hasDepartureNTTProblem: FilterFieldInput
    "IATA коды аэропорта прибытия"
    latestArrivalStation: FilterFieldInput
    "IATA коды аэропорта прибытия"
    latestDepartureStation: FilterFieldInput
    "Тип наземного обслуживания"
    serviceType: FilterFieldInput
    "Бортовой номер"
    tail: FilterFieldInput
}

"Настройка сортировки"
input OrderFieldInput {
    "Имя атрибута по которому выполняется сортировка"
    attribute: String
    "Оператор сортировки asc/desc"
    operator: String
    "Имя поля по которому выполняется сортировка"
    path: String
    "Имя поля по которому выполняется сортировка"
    value: String
}

input PassengerBaggageDTOInput {
    "Комментарий"
    comment: String
    "Количество мест багажа"
    count: Int
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    "Багажные бирки"
    tags: [String]
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
    "Вес багажа"
    weight: Int
}

input PassengerBookingDTOInput {
    "Комментарий"
    comment: String
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Класс обслуживания"
    paxClass: String
    "Код бронирования"
    pnr: String
    "Приоритет источника"
    priority: Int
    "Подкласс"
    serviceClass: String
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    "Статус пассажира"
    status: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

input PassengerDTOInput {
    "Багаж пассажира"
    baggage: PassengerBaggageDTOInput
    "Описание брони"
    booking: PassengerBookingDTOInput
    currentLegId: String
    "Id"
    id: String
    isRebooked: Boolean!
    "Id рейса к которому привязан пассажир"
    legId: String
    nextLegId: String
    "Имя пассажира"
    paxName: PassengerNameDTOInput
    previousLegId: String
    rebookingId: String
    "Кресла занимаемые пассажиром"
    seats: PassengerSeatsDTOInput
    "Spi"
    spiForPax: [SpiRecordDTOInput]
    status: String
}

input PassengerNameDTOInput {
    "Комментарий"
    comment: String
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Полное имя"
    name: String
    "Имя пассажира"
    names: [PassengerNameStructDTOInput]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

input PassengerNameStructDTOInput {
    "Имя пассажира"
    name: String
    nameRu: String
    "Фамилия пассажира"
    surname: String
    surnameRu: String
}

input PassengerSeatsDTOInput {
    "Комментарий"
    comment: String
    "Количество кресел"
    count: Int
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    "Кресла"
    numbers: [String]
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

input RebookingInputInput {
    comment: String
    newDepartureLegId: String!
    passengerList: [String!]!
    sourceConnectionId: String!
}

input SpiRecordDTOInput {
    "Комментарий"
    comment: String
    count: BigInteger
    "Id записи"
    id: String
    "Id плеча к которому привязана запись"
    legId: String
    "Список ссылок на медиа"
    links: [String]
    name: String
    "Приоритет источника"
    priority: Int
    "Источник"
    source: String
    "ИАТА код аэропорта к которому привязана запись"
    station: String
    """

    {
    "description": "Время формирования",
    "format": "HH:mm"
    }
    (ISO-8601)
    """
    timestamp: DateTime
}

input TobtInputInput {
    comment: String
    legId: String!
    stationId: String
    "ISO-8601"
    value: DateTime!
}
`

export default demoGqlSchema
