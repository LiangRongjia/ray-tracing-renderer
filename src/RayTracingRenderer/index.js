// @ts-check
import { loadExtensions } from './glUtil.js'
import { makeRenderingPipeline } from './RenderingPipeline/index.js'
import * as THREE from 'three'

/**
 * @typedef {{
 *  draw: (camera: any) => void;
 *  drawFull: (camera: any) => void;
 *  setSize: (w: any, h: any) => void;
 *  time: (newTime: any) => void;
 *  getTotalSamplesRendered(): number;
 *  onSampleRendered: () => void;
 *}} Pipeline
 */

const glRequiredExtensions = [
  'EXT_color_buffer_float', // enables rendering to float buffers
  'EXT_float_blend',
]

const glOptionalExtensions = [
  'OES_texture_float_linear', // enables gl.LINEAR texture filtering for float textures,
]

/**
 * 创建一个变量，获取其 `getter` 和 `setter`
 * @template T
 * @param { T } initValue 初始值
 * @returns { [ () => T, (value: T) => void ] } 元组 `[ getter, setter ]`
 */
const createVar = (initValue) => {
  const ref = {
    value: initValue
  }

  const getter = () => ref.value

  /**  @param { T } value  */
  const setter = (value) => {
    ref.value = value
  }

  return [getter, setter]
}

function RayTracingRenderer(params = {}) {
  const canvas = params.canvas || document.createElement('canvas')

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    depth: true,
    stencil: false,
    antialias: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: true
  })

  loadExtensions(gl, glRequiredExtensions)
  const optionalExtensions = loadExtensions(gl, glOptionalExtensions)

  const size = new THREE.Vector2()

  /**@type { [ () => Pipeline | undefined, (value: Pipeline | null) => void ] } */
  const [pipeline, setPipeline] = createVar(null)

  const [getPixelRatio, setPixelRatio] = createVar(1)
  const [isValidTime, setIsValidTime] = createVar(1)
  const [currentTime, setCurrentTime] = createVar(NaN)
  const [syncWarning, setSyncWarning] = createVar(false)

  const restartTimer = () => {
    setIsValidTime(NaN)
  }

  let lastFocus = false

  const module = {
    bounces: 2,
    domElement: canvas,
    maxHardwareUsage: false,
    needsUpdate: true,
    onSampleRendered: null,
    renderWhenOffFocus: true,
    toneMapping: THREE.LinearToneMapping,
    toneMappingExposure: 1,
    toneMappingWhitePoint: 1,
    /**
     * 设置 canvas 元素外观大小，自动根据渲染缩放比同步渲染分辨率
     * @param { number } width 
     * @param { number } height 
     * @param { boolean } updateStyle 是否更新外观大小
     */
    setSize: (width, height, updateStyle = true) => {
      size.set(width, height)
      canvas.width = size.width * getPixelRatio()
      canvas.height = size.height * getPixelRatio()

      if (updateStyle) {
        canvas.style.width = `${size.width}px`
        canvas.style.height = `${size.height}px`
      }

      if (pipeline()) {
        pipeline().setSize(size.width * getPixelRatio(), size.height * getPixelRatio())
      }
    },
    /**
     * @param { THREE.Vector2 } target 
     */
    getSize: (target) => {
      if (!target) {
        target = new THREE.Vector2()
      }

      return target.copy(size)
    },
    /**
     * 设置渲染缩放比
     * @param { number } x 
     */
    setPixelRatio: (x) => {
      if (!x) {
        return
      }
      setPixelRatio(x)
      module.setSize(size.width, size.height, false)
    },
    /**
     * 获取渲染缩放比
     */
    getPixelRatio: () => getPixelRatio(),
    getTotalSamplesRendered: () => {
      if (pipeline()) {
        return pipeline().getTotalSamplesRendered()
      }
    },
    /**
     * @param { number } t 
     */
    sync: (t) => {
      // the first call to the callback of requestAnimationFrame does not have a time parameter
      // use performance.now() in this case
      setCurrentTime(t || performance.now())
    },
    /**
     * 渲染
     * @param { THREE.Scene } scene 
     * @param { THREE.Camera } camera 
     */
    render: (scene, camera) => {
      if (!module.renderWhenOffFocus) {
        const hasFocus = document.hasFocus()
        if (!hasFocus) {
          lastFocus = hasFocus
          return
        } else if (hasFocus && !lastFocus) {
          lastFocus = hasFocus
          restartTimer()
        }
      }

      if (module.needsUpdate) {
        initScene(scene)
      }

      if (isNaN(currentTime())) {
        if (!syncWarning()) {
          console.warn('Ray Tracing Renderer warning: For improved performance, please call renderer.sync(time) before render.render(scene, camera), with the time parameter equalling the parameter passed to the callback of requestAnimationFrame')
          setSyncWarning(true)
        }

        setCurrentTime(performance.now()) // less accurate than requestAnimationFrame's time parameter
      }

      pipeline().time(isValidTime() * currentTime())

      setIsValidTime(1)
      setCurrentTime(NaN)

      camera.updateMatrixWorld()

      if (module.maxHardwareUsage) {
        // render new sample for the entire screen
        pipeline().drawFull(camera)
      } else {
        // render new sample for a tiled subset of the screen
        pipeline().draw(camera)
      }
    },
    dispose: () => {
      document.removeEventListener('visibilitychange', restartTimer)
      setPipeline(null)
    }
  }

  function initScene(scene) {
    scene.updateMatrixWorld()

    const toneMappingParams = {
      exposure: module.toneMappingExposure,
      whitePoint: module.toneMappingWhitePoint,
      toneMapping: module.toneMapping
    }

    const bounces = module.bounces

    setPipeline(makeRenderingPipeline({ gl, optionalExtensions, scene, toneMappingParams, bounces }))

    pipeline().onSampleRendered = (...args) => {
      if (module.onSampleRendered) {
        module.onSampleRendered(...args)
      }
    }

    module.setSize(size.width, size.height)
    module.needsUpdate = false
  }

  // Assume module.render is called using requestAnimationFrame.
  // This means that when the user is on a different browser tab, module.render won't be called.
  // Since the timer should not measure time when module.render is inactive,
  // the timer should be reset when the user switches browser tabs
  document.addEventListener('visibilitychange', restartTimer)

  return module
}

RayTracingRenderer.isSupported = () => {
  const gl = document.createElement('canvas')
    .getContext('webgl2', {
      failIfMajorPerformanceCaveat: true
    })

  if (!gl) {
    return false
  }

  const extensions = loadExtensions(gl, glRequiredExtensions)
  for (let e in extensions) {
    if (!extensions[e]) {
      return false
    }
  }

  return true
}

export { RayTracingRenderer }