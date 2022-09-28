import type { Plugin } from 'vue'
import { computed, getCurrentInstance, inject, onScopeDispose, watch } from 'vue'
import { defu } from 'defu'
import { createTokensHelper, isToken, resolveVariableFromPath, sanitizeProps, transformTokensToVariable } from './utils'
import { bindClass, getIds } from './instance'
import { usePinceauRuntimeState } from './state'
import { usePinceauStylesheet } from './stylesheet'

export const plugin: Plugin = {
  install(app, { theme, helpersConfig }) {
    theme = defu(theme || {}, { theme: {}, aliases: {} })

    helpersConfig = defu(helpersConfig, { flattened: true })

    const $tokens = createTokensHelper(theme.theme, theme.aliases, helpersConfig)

    const state = usePinceauRuntimeState()

    const { getStylesheetContent, updateStylesheet } = usePinceauStylesheet(state, $tokens)

    const setupPinceauRuntime = (
      props: any,
      variants: any,
    ) => {
      const instance = getCurrentInstance()

      const variantsPropsValues = computed(() => sanitizeProps(props, variants))

      const ids = computed(() => getIds(instance, variantsPropsValues.value, variants))

      watch(
        ids,
        (newIds, oldIds) => {
          state.push(newIds, variants, variantsPropsValues)
          bindClass(instance, newIds, oldIds)
        },
        {
          immediate: true,
        },
      )

      onScopeDispose(() => state.drop(ids.value))
    }

    app.config.globalProperties.$pinceau = setupPinceauRuntime
    app.config.globalProperties.$pinceauSsr = { getStylesheetContent, updateStylesheet }
    app.provide('pinceau', setupPinceauRuntime)
  },
}

export const utils = {
  resolveVariableFromPath,
  transformTokensToVariable,
  isToken,
}

/**
 * Entrypoint for Pinceau runtime features.
 */
export function usePinceauRuntime(
  props: any,
  variants: any,
): void {
  return (inject('pinceau') as any)(props, variants)
}
