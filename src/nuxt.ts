import { join, resolve } from 'pathe'
import glob from 'fast-glob'
import { addPluginTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { PinceauOptions } from './types'
import pinceau, { defaultOptions } from './unplugin'

const module: any = defineNuxtModule<PinceauOptions>({
  meta: {
    name: 'pinceau/nuxt',
    configKey: 'pinceau',
  },
  defaults: nuxt => ({
    ...defaultOptions,
    colorSchemeMode: 'class',
    outputDir: join(nuxt.options.buildDir, 'pinceau/'),
  }),
  async setup(options: PinceauOptions, nuxt) {
    const modulePath = createResolver(import.meta.url)

    // Call options hook
    await nuxt.callHook('pinceau:options', options)

    // Automatically inject generated types to tsconfig
    nuxt.hook('prepare:types', (opts) => {
      const tsConfig: typeof opts.tsConfig & { vueCompilerOptions?: any } = opts.tsConfig
      tsConfig.compilerOptions = tsConfig.compilerOptions || {}
      tsConfig.compilerOptions.paths = tsConfig.compilerOptions.paths || {}

      if (options?.outputDir) {
        const relativeOutputDir = options?.outputDir || join(nuxt.options.buildDir, 'pinceau/')
        tsConfig.compilerOptions.paths['#pinceau/types'] = [`${resolve(relativeOutputDir, 'types.ts')}`]
        tsConfig.compilerOptions.paths['#pinceau/theme/flat'] = [`${resolve(relativeOutputDir, 'flat.ts')}`]
        tsConfig.compilerOptions.paths['#pinceau/theme'] = [`${resolve(relativeOutputDir, 'index.ts')}`]
      }

      tsConfig.vueCompilerOptions = tsConfig.vueCompilerOptions || {}
      tsConfig.vueCompilerOptions.plugins = tsConfig.vueCompilerOptions.plugins || []
      tsConfig.vueCompilerOptions.plugins.push('pinceau/volar')
    })

    // Setup Nitro plugin
    if (!nuxt.options.nitro) { nuxt.options.nitro = {} }
    if (!nuxt.options.nitro.plugins) { nuxt.options.nitro.plugins = [] }
    nuxt.options.nitro.plugins.push(modulePath.resolve('./nitro'))

    // Support for `extends` feature
    // This will scan each layer for a config file
    const layerPaths = nuxt.options._layers.reduce(
      (acc: string[], layer: any) => {
        if (layer?.cwd) {
          acc.push(layer?.cwd)
        }
        return acc
      },
      [],
    )
    layerPaths.forEach(
      (path: string) => {
        if (!(options?.configOrPaths as string[]).includes(path)) {
          (options.configOrPaths as string[]).push(path)
        }
      },
    )

    // Set `cwd` from Nuxt rootDir
    options.cwd = nuxt.options.rootDir

    // Automatically inject all components in layers into includes
    for (const layer of layerPaths) {
      options.includes?.push(...await glob(join(layer, '**/*.vue'), { followSymbolicLinks: options.followSymbolicLinks }))
    }

    addPluginTemplate({
      filename: 'pinceau-imports.mjs',
      getContents() {
        const lines = [
          'import { useState } from \'#app\'',
          'import \'pinceau.css\'',
          'import { plugin as pinceau } from \'pinceau/runtime\'',
          'import theme from \'#pinceau/theme/flat\'',
          `export default defineNuxtPlugin((nuxtApp) => {
            nuxtApp.vueApp.use(pinceau, { theme, colorSchemeMode: 'class' })

            // Handle first render of SSR styles
            nuxtApp.hook('app:rendered', (app) => {
              const content = app.ssrContext.nuxt.vueApp.config.globalProperties.$pinceauSsr.get()
              app.ssrContext.event.pinceauContent = content
            })
          })`,
        ]

        if (options?.preflight) {
          lines.unshift('import \'@unocss/reset/tailwind.css\'')
        }

        return lines.join('\n')
      },
    })

    // Webpack plugin
    nuxt.hook('webpack:config', (config: any) => {
      config.plugins = config.plugins || []
      config.plugins.unshift(pinceau.webpack(options))
    })

    // Vite plugin
    nuxt.hook('vite:extend', (vite: any) => {
      vite.config.plugins = vite.config.plugins || []
      vite.config.plugins.push(pinceau.vite(options))
    })
  },
})

export default module
