import { makeRenderingPipeline } from './RenderingPipeline/index.js'
import * as THREE from 'three'

interface Pipeline {
  draw: (camera: any) => void
  drawFull: (camera: any) => void
  setSize: (w: any, h: any) => void
  time: (newTime: any) => void
  getTotalSamplesRendered(): number
  onSampleRendered: () => void
}

const glRequiredExtensions = [
  'EXT_color_buffer_float', // enables rendering to float buffers
  'EXT_float_blend'
]

const glOptionalExtensions = [
  'OES_texture_float_linear' // enables gl.LINEAR texture filtering for float textures,
]

class RayTracingRenderer {
  #canvas: HTMLCanvasElement = document.createElement('canvas')
  #gl: WebGL2RenderingContext | null = null
  #size: THREE.Vector2 = new THREE.Vector2()
  #pipeline: Pipeline | null = null
  #pixelRatio: number = 1
  #isValidTime: number = 1
  #currentTime: number = NaN
  #syncWarning: boolean = false
  #lastFocus: boolean = false
  #optionalExtensions: any = undefined
  #restartTimer: () => void = () => {
    this.#isValidTime = NaN
  }
  #initScene: (scene: THREE.Scene) => void = (scene) => {
    scene.updateMatrixWorld()

    const toneMappingParams = {
      exposure: this.toneMappingExposure,
      whitePoint: this.toneMappingWhitePoint,
      toneMapping: this.toneMapping
    }

    const bounces = this.bounces

    if (this.#gl === null) {
      throw new Error('this.#gl === null')
    }

    this.#pipeline = makeRenderingPipeline({
      gl: this.#gl,
      optionalExtensions: this.#optionalExtensions,
      scene,
      toneMappingParams,
      bounces
    })

    if (this.#pipeline) {
      this.#pipeline.onSampleRendered = (...args) => {
        if (this.onSampleRendered !== null) {
          this.onSampleRendered(...args)
        }
      }
    }

    this.setSize(this.#size.width, this.#size.height)
    this.needsUpdate = false
  }

  bounces: number = 2
  maxHardwareUsage: boolean = false
  needsUpdate: boolean = true
  onSampleRendered: (...args: any) => any = () => void 0
  renderWhenOffFocus: boolean = true
  toneMapping: THREE.ToneMapping = THREE.LinearToneMapping
  toneMappingExposure: number = 1
  toneMappingWhitePoint: number = 1

  /** 获取 canvas 元素，兼容原版接口 */
  get domElement() {
    return this.#canvas
  }

  constructor(canvasElement?: HTMLCanvasElement) {
    this.#canvas = canvasElement || document.createElement('canvas')
    // this.domElement = this.#canvas

    this.#gl = this.#canvas.getContext('webgl2', {
      alpha: false,
      depth: true,
      stencil: false,
      antialias: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true
    })

    if (!this.#gl) {
      alert('你的浏览器不支持 webgl2，可能需要开启实验性功能或升级、更换浏览器。')
      return
    }

    glRequiredExtensions.map((name) => this.#gl?.getExtension(name))
    this.#optionalExtensions = glOptionalExtensions.map((name) => this.#gl?.getExtension(name))

    // Assume module.render is called using requestAnimationFrame.
    // This means that when the user is on a different browser tab, module.render won't be called.
    // Since the timer should not measure time when module.render is inactive,
    // the timer should be reset when the user switches browser tabs
    document.addEventListener('visibilitychange', () => this.#restartTimer())

    return this
  }

  /** 设置 canvas 元素外观大小，自动根据渲染缩放比同步渲染分辨率 */
  setSize(width: number, height: number, updateStyle: boolean = true) {
    this.#size.set(width, height)
    this.#canvas.width = this.#size.width * this.#pixelRatio
    this.#canvas.height = this.#size.height * this.#pixelRatio

    if (updateStyle) {
      this.#canvas.style.width = `${this.#size.width}px`
      this.#canvas.style.height = `${this.#size.height}px`
    }

    this.#pipeline?.setSize(this.#size.width * this.#pixelRatio, this.#size.height * this.#pixelRatio)
  }

  getSize(target?: THREE.Vector2) {
    return target ? target.copy(this.#size) : new THREE.Vector2().copy(this.#size)
  }

  /** 设置渲染缩放比 */
  setPixelRatio(x: number): void {
    this.#pixelRatio = x
    this.setSize(this.#size.width, this.#size.height, false)
  }

  /** 获取渲染缩放比 */
  getPixelRatio(): number {
    return this.#pixelRatio
  }

  getTotalSamplesRendered(): number | undefined {
    return this.#pipeline?.getTotalSamplesRendered()
  }

  sync(t: number): void {
    // the first call to the callback of requestAnimationFrame does not have a time parameter
    // use performance.now() in this case
    this.#currentTime = t || performance.now()
  }

  /** 渲染 */
  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.renderWhenOffFocus) {
      const hasFocus = document.hasFocus()
      if (!hasFocus) {
        this.#lastFocus = hasFocus
        return
      }
      if (hasFocus && !this.#lastFocus) {
        this.#lastFocus = hasFocus
        this.#restartTimer()
      }
    }

    if (this.needsUpdate) {
      this.#initScene(scene)
    }

    if (isNaN(this.#currentTime)) {
      if (!this.#syncWarning) {
        console.warn(
          'Ray Tracing Renderer warning: For improved performance, please call renderer.sync(time) before render.render(scene, camera), with the time parameter equalling the parameter passed to the callback of requestAnimationFrame'
        )
        this.#syncWarning = true
      }

      this.#currentTime = performance.now() // less accurate than requestAnimationFrame's time parameter
    }

    this.#pipeline?.time(this.#isValidTime * this.#currentTime)

    this.#isValidTime = 1
    this.#currentTime = NaN

    camera.updateMatrixWorld()

    if (this.maxHardwareUsage) {
      // render new sample for the entire screen
      this.#pipeline?.drawFull(camera)
    } else {
      // render new sample for a tiled subset of the screen
      this.#pipeline?.draw(camera)
    }
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.#restartTimer)
    this.#pipeline = null
  }

  static isSupported() {
    const gl = document.createElement('canvas').getContext('webgl2', {
      failIfMajorPerformanceCaveat: true
    })

    if (!gl) {
      return false
    }

    const extensions = glRequiredExtensions.map((name) => gl.getExtension(name))

    if (Object.values(extensions).some((extension) => !extension)) {
      return false
    }

    return true
  }
}

export { RayTracingRenderer }
