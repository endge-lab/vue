import { defineStore } from 'pinia'
import { computed } from 'vue'
import { Endge } from '@endge/core'
import { useSubscribableRef } from '@endge/utils'

export const useDomainStore = defineStore('endge-domain-store', () => {
  const { refObj: domain } = useSubscribableRef(Endge.domain)
  const { refObj: program } = useSubscribableRef(Endge.program)
  const { refObj: eventsRef } = useSubscribableRef(Endge.events)

  // Все проекты домена
  const projects = computed(() => domain.value.getProjects())

  // Все типы домена
  const types = computed(() => domain.value.getTypes())

  // Примитивные типы домена
  const typesPrimitives = computed(() =>
    types.value.filter((x) => x.isPrimitive),
  )

  // Сложные типы домена
  const typesComplex = computed(() => types.value.filter((x) => !x.isPrimitive))

  // Editor-facing Type Registry. Legacy RType.fields is intentionally excluded.
  const typeCatalog = computed(() => {
    const compiled = program.value.getTypeCatalog()
    if (compiled.length)
      return compiled
    return types.value.map((type) => {
      const primitiveKind = String(type.meta?.primitiveKind ?? '').trim()
      const category = primitiveKind === 'reference'
        ? 'reference' as const
        : type.isPrimitive
          ? 'primitive' as const
          : 'user' as const
      const parsed = !type.isPrimitive
        ? Endge.source.compile('type', String(type.source ?? '')).artifact as { definition?: unknown } | undefined
        : undefined
      const target = String(type.meta?.target ?? '').trim()
      return {
        id: type.id,
        identity: type.identity,
        displayName: type.displayName || type.name || type.identity,
        category,
        sourceVersion: Number(type.sourceVersion ?? 1) || 1,
        definition: (parsed?.definition ?? null) as ReturnType<typeof program.value.getTypeCatalog>[number]['definition'],
        runtimeType: type.isPrimitive ? String(type.meta?.runtimeType ?? type.identity) : undefined,
        entityReference: category === 'reference' && target
          ? { target, storage: type.meta?.storage === 'identity' ? 'identity' as const : 'id' as const }
          : undefined,
        status: 'valid' as const,
      }
    })
  })

  // Все запросы домена
  const queries = computed(() => domain.value.getQueries())

  // Пользовательские компоненты
  const components = computed(() => domain.value.getComponents())

  // SFC-компоненты нового API
  const componentSFCs = computed(() => domain.value.getComponentSFCs())

  // Пользовательские действия
  const actions = computed(() => domain.value.getActions())

  // Пользовательские конвертеры
  const converters = computed(() => domain.value.getConverters())

  // Интеграции
  const integrations = computed(() => domain.value.getIntegrations())

  // Шаблоны страниц
  const pageTemplates = computed(() => domain.value.getPageTemplates())

  // Страницы
  const pages = computed(() => domain.value.getPages())

  // Навигации
  const navigations = computed(() => domain.value.getNavigations())

  // Папки редактора
  const folders = computed(() => domain.value.getFolders())

  // Закешированные последние события
  const events = computed(() => eventsRef.value.lastEvents)

  // Параметры (коллекция parameters в Payload)
  const parameters = computed(() => domain.value.getParameters())

  // Фильтры (коллекция filters в Payload)
  const filters = computed(() => domain.value.getFilters())

  // Runtime-композиции (коллекция compositions в Payload)
  const compositions = computed(() => domain.value.getCompositions())

  // Окружения (коллекция environments в Payload)
  const environments = computed(() => domain.value.getEnvironments())

  // Тенанты (коллекция tenants в Payload)
  const tenants = computed(() => domain.value.getTenants())

  // Политики (коллекция policies в Payload)
  const policies = computed(() => domain.value.getPolicies())

  // Стили (коллекция styles в Payload)
  const styles = computed(() => domain.value.getStyles())

  // Словари (коллекция vocabs в Payload)
  const vocabs = computed(() => domain.value.getVocabs())

  // Словари переводов (коллекция i18n-bundles в Payload)
  const i18nBundles = computed(() => domain.value.getI18nBundles())

  // Mock-документы (коллекция mocks в Payload)
  const mocks = computed(() => domain.value.getMocks())

  // Профили авторизации (коллекция auth-profiles в Payload)
  const authProfiles = computed(() => domain.value.getAuthProfiles())

  // Имена зарегистрированных названий запросов
  const queriesNames = computed(() => {
    return ['query-gql', 'query-rest']
  })

  return {
    domain,
    projects,
    types,
    typesPrimitives,
    typesComplex,
    typeCatalog,
    queries,
    components,
    componentSFCs,
    actions,
    converters,
    integrations,
    pageTemplates,
    pages,
    navigations,
    folders,
    queriesNames,
    parameters,
    filters,
    compositions,
    environments,
    tenants,
    policies,
    styles,
    vocabs,
    i18nBundles,
    mocks,
    authProfiles,
    events,
  }
})
