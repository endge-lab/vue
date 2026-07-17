import type {
  EndgeStyleDiagnostic,
  EndgeStyleMatchNode,
  EndgeStylePlacement,
  EndgeStyleRule,
  EndgeStyleSelector,
  EndgeStyleSheetArtifact,
  EndgeStyleSpecificity,
  EndgeStyleTargetProfile,
} from '@endge/core'
import { evaluateEndgeStyleSupport, matchEndgeStyleRule } from '@endge/core'

export interface EndgeDOMStyleClassEntry {
  artifactIdentity: string
  ruleId: string
  selectorIndex: number
  className: string
}

export interface EndgeDOMStyleMaterialization {
  css: string
  classes: EndgeDOMStyleClassEntry[]
  diagnostics: EndgeStyleDiagnostic[]
}

export type EndgeDOMStyleInput = EndgeStyleSheetArtifact | EndgeStylePlacement

function generatedClass(rule: EndgeStyleRule, selectorIndex: number): string {
  return `endge-${rule.id}-${selectorIndex}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function compareSpecificity(left: EndgeStyleSpecificity, right: EndgeStyleSpecificity): number {
  return left.ids - right.ids || left.classes - right.classes || left.types - right.types
}

function cssString(value: string): string {
  return JSON.stringify(value)
}

function collectCapabilities(rule: EndgeStyleRule): string[] {
  const result: string[] = []
  const visit = (condition: EndgeStyleRule['supports']) => {
    if (!condition) return
    if (condition.type === 'capability') result.push(condition.capability)
    else if (condition.type === 'not') visit(condition.operand)
    else if (condition.type === 'and' || condition.type === 'or') condition.operands.forEach(visit)
  }
  visit(rule.supports)
  return result
}

/** Converts neutral EndgeCSS artifacts to browser CSS over generated runtime classes. */
export function materializeEndgeCSSForDOM(
  inputs: readonly EndgeDOMStyleInput[],
  target: EndgeStyleTargetProfile = { renderer: 'dom', capabilities: [] },
): EndgeDOMStyleMaterialization {
  const diagnostics: EndgeStyleDiagnostic[] = []
  const classes: EndgeDOMStyleClassEntry[] = []
  const availableCapabilities = new Set(target.capabilities ?? [])
  const declarations: Array<{
    selector: EndgeStyleSelector
    className: string
    property: string
    value: string
    important: boolean
    sourceOrder: number
    boundaryId?: string
    theme?: string
  }> = []

  inputs.forEach((input, artifactOrder) => {
    const artifact = isPlacement(input) ? input.artifact : input
    const boundaryId = isPlacement(input) ? input.boundaryId : undefined
    for (const theme of artifact.themes) {
      const root = artifact.scope === 'component' && artifact.scopeId
        ? `[data-endge-scope-root=${cssString(artifact.scopeId)}]`
        : ':root'
      const declarationsText = theme.declarations
        .map(declaration => `${declaration.property}:${declaration.value}${declaration.important ? '!important' : ''};`)
        .join('')
      if (declarationsText)
        declarations.push({
          selector: { source: root, segments: [], specificity: { ids: 0, classes: 0, types: 0 } },
          className: root,
          property: '',
          value: declarationsText,
          important: false,
          sourceOrder: artifactOrder * 1_000_000 - 1,
          boundaryId,
          theme: theme.id,
        })
    }

    for (const rule of artifact.rules) {
      for (const capability of collectCapabilities(rule)) {
        if (!availableCapabilities.has(capability)) {
          diagnostics.push({
            severity: 'warning',
            code: 'ENDGECSS_CAPABILITY_UNAVAILABLE',
            message: `DOM adapter does not expose capability "${capability}"; the guarded rule was excluded.`,
            range: rule.range,
          })
        }
      }
      if (!evaluateEndgeStyleSupport(rule.supports, target)) continue
      rule.selectors.forEach((selector, selectorIndex) => {
        const className = generatedClass(rule, selectorIndex)
        classes.push({ artifactIdentity: artifact.identity, ruleId: rule.id, selectorIndex, className })
        for (const declaration of rule.declarations) {
          declarations.push({
            selector,
            className,
            property: declaration.property,
            value: declaration.value,
            important: declaration.important,
            sourceOrder: artifactOrder * 1_000_000 + rule.sourceOrder,
            boundaryId,
            theme: rule.theme,
          })
        }
      })
    }
  })

  declarations.sort((left, right) =>
    Number(left.important) - Number(right.important)
    || compareSpecificity(left.selector.specificity, right.selector.specificity)
    || left.sourceOrder - right.sourceOrder)

  const css = declarations.map((declaration) => {
    let baseSelector = declaration.className.startsWith(':root') || declaration.className.startsWith('[data-')
      ? declaration.className
      // Every generated class has the same non-zero CSS specificity. Endge has
      // already resolved its own specificity through declaration order, while
      // the class must still be able to override renderer/vendor tag defaults.
      : `.${declaration.className}`
    if (declaration.boundaryId) {
      const marker = `[data-endge-runtime-scope~=${cssString(declaration.boundaryId)}]`
      baseSelector = baseSelector === ':root'
        ? marker
        : `${marker}${baseSelector},${marker} ${baseSelector}`
    }
    const theme = declaration.theme
    const selector = theme
      ? baseSelector.split(',').map(selectorPart =>
          selectorPart === ':root'
            ? `:root[data-endge-theme=${cssString(theme)}]`
            : `:root[data-endge-theme=${cssString(theme)}] ${selectorPart}`,
        ).join(',')
      : baseSelector
    if (!declaration.property)
      return `${selector}{${declaration.value}}`
    return `${selector}{${declaration.property}:${declaration.value}${declaration.important ? '!important' : ''};}`
  }).join('\n')

  return { css, classes, diagnostics }
}

function isPlacement(input: EndgeDOMStyleInput): input is EndgeStylePlacement {
  return 'artifact' in input && 'boundaryId' in input
}

/** Returns stable classes for all neutral selectors matching one logical node. */
export function getEndgeDOMStyleClasses(
  artifacts: readonly EndgeStyleSheetArtifact[],
  node: EndgeStyleMatchNode,
  target: EndgeStyleTargetProfile = { renderer: 'dom', capabilities: [] },
): string[] {
  const result: string[] = []
  for (const artifact of artifacts) {
    for (const rule of artifact.rules) {
      const matched = matchEndgeStyleRule(artifact, rule, node, target, rule.theme)
      rule.selectors.forEach((selector, selectorIndex) => {
        if (matched.includes(selector)) result.push(generatedClass(rule, selectorIndex))
      })
    }
  }
  return result
}
