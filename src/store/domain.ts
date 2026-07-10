import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Endge } from '@endge/core'
import { useSubscribableRef } from '@endge/utils'

export const useDomainStore = defineStore('endge-domain-store', () => {
  const { refObj: domain } = useSubscribableRef(Endge.domain)
  const { refObj: uiRegistry } = useSubscribableRef(Endge.uiRegistry)
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

  // Виды
  const views = computed(() => domain.value.getViews())

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

  // Окружения (коллекция environments в Payload)
  const environments = computed(() => domain.value.getEnvironments())

  // Тенанты (коллекция tenants в Payload)
  const tenants = computed(() => domain.value.getTenants())

  // Биндинги поведения (коллекция behavior-bindings в Payload)
  const behaviorBindings = computed(() => domain.value.getBehaviorBindings())

  // Биндинги presentation (коллекция presentation-bindings в Payload)
  const presentationBindings = computed(() => domain.value.getPresentationBindings())

  // Политики (коллекция policies в Payload)
  const policies = computed(() => domain.value.getPolicies())

  // Стили (коллекция styles в Payload)
  const styles = computed(() => domain.value.getStyles())

  // Словари (коллекция vocabs в Payload)
  const vocabs = computed(() => domain.value.getVocabs())

  // Словари переводов (коллекция i18n-bundles в Payload)
  const i18nBundles = computed(() => domain.value.getI18nBundles())

  // Профили авторизации (коллекция auth-profiles в Payload)
  const authProfiles = computed(() => domain.value.getAuthProfiles())

  // Ссылка на реактивное хранилище
  const storage = ref(Endge.store.getStates())

  // Имена зарегистрированных рендеров компонентов
  const rendersNames = computed(() => {
    return uiRegistry.value.serialize().legacyRenderers
  })

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
    queries,
    components,
    componentSFCs,
    actions,
    converters,
    integrations,
    views,
    pageTemplates,
    pages,
    navigations,
    folders,
    storage,
    rendersNames,
    queriesNames,
    parameters,
    filters,
    environments,
    tenants,
    behaviorBindings,
    presentationBindings,
    policies,
    styles,
    vocabs,
    i18nBundles,
    authProfiles,
    events,
  }
})
