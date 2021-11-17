import { decomposeScene } from './decomposeScene'
import { makeFramebuffer } from './Framebuffer'
import { FullscreenQuad } from './FullscreenQuad'
import { GBufferPass } from './GBufferPass.js'
import { makeMaterialBuffer } from './MaterialBuffer'
import { mergeMeshesToGeometry } from './mergeMeshesToGeometry'
import { makeRayTracePass } from './RayTracePass/index.js'
import { RenderSize } from './RenderSize.js'
import { ReprojectPass } from './ReprojectPass'
import { ToneMapPass } from './ToneMapPass'
import { clamp, numberArraysEqual } from '../util'
import { TileRender } from './TileRender'
import { DepthTargetAPI, TextureAPI } from './Texture'
import noiseBase64 from './texture/noise.js'
import { PerspectiveCamera, Vector2 } from 'three'

const maxReprojectedSamples = 20

// how many samples to render with uniform noise before switching to stratified noise
const numUniformSamples = 4

// how many partitions of stratified noise should be created
// higher number results in faster convergence over time, but with lower quality initial samples
const strataCount = 6

// tile rendering can cause the GPU to stutter, throwing off future benchmarks for the preview frames
// wait to measure performance until this number of frames have been rendered
const previewFramesBeforeBenchmark = 2

interface Buffer {
  color: {
    [key: string]: {
      target: number
      texture: WebGLTexture
    }
  }
  bind: () => void
  unbind: () => void
}

interface PipelineClassProps {
  gl: WebGL2RenderingContext
  optionalExtensions: string[]
  scene: THREE.Scene
  toneMappingParams: any
  bounces: number // number of global illumination bounces
}

class RenderingPipeline {
  getTotalSamplesRendered() {
    return this.#sampleCount
  }
  set onSampleRendered(cb) {
    this.#sampleRenderedCallback = cb
  }
  get onSampleRendered() {
    return this.#sampleRenderedCallback
  }

  #tileRender: {
    nextTile: (elapsedFrameMs: number) => {
      x: number
      y: number
      tileWidth: number
      tileHeight: number
      isFirstTile: boolean
      isLastTile: boolean
    }
    reset: () => void
    setSize: (w: number, h: number) => void
  }
  #previewSize: RenderSize
  #decomposedScene: any
  #mergedMesh: any
  #materialBuffer:
    | {
        defines: {
          NUM_MATERIALS: any
          NUM_DIFFUSE_MAPS: number
          NUM_NORMAL_MAPS: number
          NUM_DIFFUSE_NORMAL_MAPS: number
          NUM_PBR_MAPS: number
        }
        textures:
          | {
              pbrMap: { target: number; texture: WebGLTexture }
              normalMap: { target: number; texture: WebGLTexture }
              diffuseMap: { target: number; texture: WebGLTexture }
            }
          | {
              pbrMap?: undefined
              normalMap: { target: number; texture: WebGLTexture }
              diffuseMap: { target: number; texture: WebGLTexture }
            }
          | {
              pbrMap: { target: number; texture: WebGLTexture }
              normalMap?: undefined
              diffuseMap: { target: number; texture: WebGLTexture }
            }
          | { pbrMap?: undefined; normalMap?: undefined; diffuseMap: { target: number; texture: WebGLTexture } }
          | {
              pbrMap: { target: number; texture: WebGLTexture }
              normalMap: { target: number; texture: WebGLTexture }
              diffuseMap?: undefined
            }
          | { pbrMap?: undefined; normalMap: { target: number; texture: WebGLTexture }; diffuseMap?: undefined }
          | { pbrMap: { target: number; texture: WebGLTexture }; normalMap?: undefined; diffuseMap?: undefined }
          | { pbrMap?: undefined; normalMap?: undefined; diffuseMap?: undefined }
      }
    | undefined
  #fullscreenQuad: FullscreenQuad
  #rayTracePass: {
    bindTextures: () => void
    draw: () => void
    nextSeed: () => void
    outputLocs: {}
    setCamera: (camera: any) => void
    setJitter: (x: any, y: any) => void
    setGBuffers: ({
      position,
      normal,
      faceNormal,
      color,
      matProps
    }: {
      position: any
      normal: any
      faceNormal: any
      color: any
      matProps: any
    }) => void
    setNoise: (noiseImage: any) => void
    setSize: (width: any, height: any) => void
    setStrataCount: (strataCount: any) => void
  }
  #reprojectPass: ReprojectPass
  #toneMapPass: { draw: (params: any) => void }
  #gBufferPass: any
  #ready: boolean
  #noiseImage: HTMLImageElement
  #frameTime: any
  #elapsedFrameTime: any
  #sampleTime: any
  #sampleCount: number
  #numPreviewsRendered: number
  #firstFrame: boolean
  #sampleRenderedCallback: any
  #lastCamera: PerspectiveCamera
  #screenWidth: number
  #screenHeight: number
  #fullscreenScale: Vector2
  #lastToneMappedScale: any
  #hdrBuffer: any
  #hdrBackBuffer: any
  #reprojectBuffer: any
  #reprojectBackBuffer: any
  #gBuffer: any
  #gBufferBack: any
  #lastToneMappedTexture: any
  #gl: WebGL2RenderingContext
  constructor({
    gl,
    optionalExtensions,
    scene,
    toneMappingParams,
    bounces // number of global illumination bounces
  }: PipelineClassProps) {
    this.#gl = gl
    // used to sample only a portion of the scene to the HDR Buffer to prevent the GPU from locking up from excessive computation
    this.#tileRender = new TileRender(gl)
    this.#previewSize = RenderSize.createWithGl(gl)
    this.#decomposedScene = decomposeScene(scene)
    this.#mergedMesh = mergeMeshesToGeometry(this.#decomposedScene.meshes)
    this.#materialBuffer = makeMaterialBuffer(gl, this.#mergedMesh.materials)
    this.#fullscreenQuad = new FullscreenQuad(gl)
    this.#rayTracePass = makeRayTracePass(gl, {
      bounces,
      decomposedScene: this.#decomposedScene,
      fullscreenQuad: this.#fullscreenQuad,
      materialBuffer: this.#materialBuffer,
      mergedMesh: this.#mergedMesh,
      optionalExtensions
    })
    this.#reprojectPass = ReprojectPass.createWithGl(gl, {
      fullscreenQuad: this.#fullscreenQuad,
      maxReprojectedSamples
    })
    this.#toneMapPass = new ToneMapPass(gl, { fullscreenQuad: this.#fullscreenQuad, toneMappingParams })
    this.#gBufferPass = new GBufferPass({ gl, materialBuffer: this.#materialBuffer, mergedMesh: this.#mergedMesh })
    this.#ready = false
    this.#noiseImage = new Image()
    this.#noiseImage.src = noiseBase64
    this.#noiseImage.onload = () => {
      this.#rayTracePass.setNoise(this.#noiseImage)
      this.#ready = true
    }
    this.#frameTime
    this.#elapsedFrameTime
    this.#sampleTime
    this.#sampleCount = 0
    this.#numPreviewsRendered = 0
    this.#firstFrame = true
    this.#sampleRenderedCallback
    this.#lastCamera = new PerspectiveCamera()
    this.#lastCamera.position.set(1, 1, 1)
    this.#lastCamera.updateMatrixWorld()
    this.#screenWidth = 0
    this.#screenHeight = 0
    this.#fullscreenScale = new Vector2(1, 1)
    this.#lastToneMappedScale = this.#fullscreenScale
    return this
  }

  private initFrameBuffers(width: number, height: number) {
    const makeHdrBuffer = () =>
      makeFramebuffer(this.#gl, {
        color: {
          0: TextureAPI.new(this.#gl, {
            width,
            height,
            storage: 'float',
            magFilter: this.#gl.LINEAR,
            minFilter: this.#gl.LINEAR
          })
        }
      })

    const makeReprojectBuffer = () =>
      makeFramebuffer(this.#gl, {
        color: {
          0: TextureAPI.new(this.#gl, {
            width,
            height,
            storage: 'float',
            magFilter: this.#gl.LINEAR,
            minFilter: this.#gl.LINEAR
          })
        }
      })

    this.#hdrBuffer = makeHdrBuffer()
    this.#hdrBackBuffer = makeHdrBuffer()

    this.#reprojectBuffer = makeReprojectBuffer()
    this.#reprojectBackBuffer = makeReprojectBuffer()

    const normalBuffer = TextureAPI.new(this.#gl, { width, height, storage: 'halfFloat' })
    const faceNormalBuffer = TextureAPI.new(this.#gl, { width, height, storage: 'halfFloat' })
    const colorBuffer = TextureAPI.new(this.#gl, { width, height, storage: 'byte', channels: 3 })
    const matProps = TextureAPI.new(this.#gl, { width, height, storage: 'byte', channels: 2 })
    const depthTarget = DepthTargetAPI.new(this.#gl, width, height)

    const makeGBuffer = () =>
      makeFramebuffer(this.#gl, {
        color: {
          // @ts-ignore
          [this.#gBufferPass.outputLocs.position]: TextureAPI.new(this.#gl, { width, height, storage: 'float' }),
          // @ts-ignore
          [this.#gBufferPass.outputLocs.normal]: normalBuffer,
          // @ts-ignore
          [this.#gBufferPass.outputLocs.faceNormal]: faceNormalBuffer,
          // @ts-ignore
          [this.#gBufferPass.outputLocs.color]: colorBuffer,
          // @ts-ignore
          [this.#gBufferPass.outputLocs.matProps]: matProps
        },
        depth: depthTarget
      })

    this.#gBuffer = makeGBuffer()
    this.#gBufferBack = makeGBuffer()

    // @ts-ignore
    this.#lastToneMappedTexture = this.#hdrBuffer.color[this.#rayTracePass.outputLocs.light]
  }

  private swapReprojectBuffer() {
    let temp = this.#reprojectBuffer
    this.#reprojectBuffer = this.#reprojectBackBuffer
    this.#reprojectBackBuffer = temp
  }

  private swapGBuffer() {
    let temp = this.#gBuffer
    this.#gBuffer = this.#gBufferBack
    this.#gBufferBack = temp
  }

  private swapHdrBuffer() {
    let temp = this.#hdrBuffer
    this.#hdrBuffer = this.#hdrBackBuffer
    this.#hdrBackBuffer = temp
  }

  // Shaders will read from the back buffer and draw to the front buffer
  // Buffers are swapped after every render
  private swapBuffers() {
    this.swapReprojectBuffer()
    this.swapGBuffer()
    this.swapHdrBuffer()
  }

  setSize(w: number, h: number) {
    this.#screenWidth = w
    this.#screenHeight = h

    this.#tileRender.setSize(w, h)
    this.#previewSize = this.#previewSize.setSize(w, h)
    this.initFrameBuffers(w, h)
    this.#firstFrame = true
  }

  // called every frame to update clock
  time(newTime: number) {
    this.#elapsedFrameTime = newTime - this.#frameTime
    this.#frameTime = newTime
  }

  private areCamerasEqual(cam1: any, cam2: any) {
    return (
      numberArraysEqual(cam1.matrixWorld.elements, cam2.matrixWorld.elements) &&
      cam1.aspect === cam2.aspect &&
      cam1.fov === cam2.fov
    )
  }

  private updateSeed(width: number, height: number, useJitter: boolean = true) {
    this.#rayTracePass.setSize(width, height)

    const jitterX = useJitter ? (Math.random() - 0.5) / width : 0
    const jitterY = useJitter ? (Math.random() - 0.5) / height : 0
    this.#gBufferPass.setJitter(jitterX, jitterY)
    this.#rayTracePass.setJitter(jitterX, jitterY)
    this.#reprojectPass = this.#reprojectPass.setJitter(jitterX, jitterY)

    if (this.#sampleCount === 0) {
      this.#rayTracePass.setStrataCount(1)
    } else if (this.#sampleCount === numUniformSamples) {
      this.#rayTracePass.setStrataCount(strataCount)
    } else {
      this.#rayTracePass.nextSeed()
    }
  }

  private clearBuffer(buffer: Buffer) {
    buffer.bind()
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT)
    buffer.unbind()
  }

  private addSampleToBuffer(buffer: Buffer, width: number, height: number) {
    buffer.bind()

    this.#gl.blendEquation(this.#gl.FUNC_ADD)
    this.#gl.blendFunc(this.#gl.ONE, this.#gl.ONE)
    this.#gl.enable(this.#gl.BLEND)

    this.#gl.viewport(0, 0, width, height)
    this.#rayTracePass.draw()

    this.#gl.disable(this.#gl.BLEND)
    buffer.unbind()
  }

  private newSampleToBuffer(buffer: Buffer, width: number, height: number) {
    buffer.bind()
    this.#gl.viewport(0, 0, width, height)
    this.#rayTracePass.draw()
    buffer.unbind()
  }

  // @ts-ignore
  private toneMapToScreen(lightTexture, lightScale) {
    this.#gl.viewport(0, 0, this.#gl.drawingBufferWidth, this.#gl.drawingBufferHeight)
    this.#toneMapPass.draw({
      light: lightTexture,
      lightScale,
      // @ts-ignore
      position: this.#gBuffer.color[this.#gBufferPass.outputLocs.position]
    })

    this.#lastToneMappedTexture = lightTexture
    this.#lastToneMappedScale = lightScale.clone()
  }

  private renderGBuffer() {
    this.#gBuffer.bind()
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT | this.#gl.DEPTH_BUFFER_BIT)
    this.#gl.viewport(0, 0, this.#screenWidth, this.#screenHeight)
    this.#gBufferPass.draw()
    this.#gBuffer.unbind()

    this.#rayTracePass.setGBuffers({
      // @ts-ignore
      position: this.#gBuffer.color[this.#gBufferPass.outputLocs.position],
      // @ts-ignore
      normal: this.#gBuffer.color[this.#gBufferPass.outputLocs.normal],
      // @ts-ignore
      faceNormal: this.#gBuffer.color[this.#gBufferPass.outputLocs.faceNormal],
      // @ts-ignore
      color: this.#gBuffer.color[this.#gBufferPass.outputLocs.color],
      // @ts-ignore
      matProps: this.#gBuffer.color[this.#gBufferPass.outputLocs.matProps]
    })
  }

  private renderTile(buffer: Buffer, x: number, y: number, width: number, height: number) {
    this.#gl.scissor(x, y, width, height)
    this.#gl.enable(this.#gl.SCISSOR_TEST)
    this.addSampleToBuffer(buffer, this.#screenWidth, this.#screenHeight)
    this.#gl.disable(this.#gl.SCISSOR_TEST)
  }

  private setCameras(camera: THREE.Camera, lastCamera: THREE.Camera) {
    this.#rayTracePass.setCamera(camera)
    this.#gBufferPass.setCamera(camera)
    this.#reprojectPass = this.#reprojectPass.setPreviousCamera(lastCamera)
    lastCamera.copy(camera)
  }

  private drawPreview() {
    if (this.#sampleCount > 0) this.swapBuffers()

    if (this.#numPreviewsRendered >= previewFramesBeforeBenchmark)
      this.#previewSize = this.#previewSize.adjustSize(this.#elapsedFrameTime) || this.#previewSize

    this.updateSeed(this.#previewSize.renderWidth, this.#previewSize.renderHeight, false)

    this.renderGBuffer()

    this.#rayTracePass.bindTextures()
    this.newSampleToBuffer(this.#hdrBuffer, this.#previewSize.renderWidth, this.#previewSize.renderHeight)

    this.#reprojectBuffer.bind()
    this.#gl.viewport(0, 0, this.#previewSize.renderWidth, this.#previewSize.renderHeight)
    this.#reprojectPass = this.#reprojectPass.draw(this.#gl, {
      blendAmount: 1.0,
      light: this.#hdrBuffer.color[0],
      lightScale: this.#previewSize.scale,
      // @ts-ignore
      position: this.#gBuffer.color[this.#gBufferPass.outputLocs.position],
      previousLight: this.#lastToneMappedTexture,
      previousLightScale: this.#lastToneMappedScale,
      // @ts-ignore
      previousPosition: this.#gBufferBack.color[this.#gBufferPass.outputLocs.position]
    })
    this.#reprojectBuffer.unbind()

    this.toneMapToScreen(this.#reprojectBuffer.color[0], this.#previewSize.scale)

    this.swapBuffers()
  }

  private drawTile() {
    const { x, y, tileWidth, tileHeight, isFirstTile, isLastTile } = this.#tileRender.nextTile(this.#elapsedFrameTime)

    if (isFirstTile) {
      if (this.#sampleCount === 0) {
        // previous rendered image was a preview image
        this.clearBuffer(this.#hdrBuffer)
        this.#reprojectPass = this.#reprojectPass.setPreviousCamera(this.#lastCamera)
      } else {
        this.#sampleRenderedCallback(this.#sampleCount, this.#frameTime - this.#sampleTime || NaN)
        this.#sampleTime = this.#frameTime
      }

      this.updateSeed(this.#screenWidth, this.#screenHeight, true)
      this.renderGBuffer()
      this.#rayTracePass.bindTextures()
    }

    this.renderTile(this.#hdrBuffer, x, y, tileWidth, tileHeight)

    if (isLastTile) {
      this.#sampleCount++

      let blendAmount = clamp(1.0 - this.#sampleCount / maxReprojectedSamples, 0, 1)
      blendAmount *= blendAmount

      if (blendAmount > 0.0) {
        this.#reprojectBuffer.bind()
        this.#gl.viewport(0, 0, this.#screenWidth, this.#screenHeight)
        this.#reprojectPass = this.#reprojectPass.draw(this.#gl, {
          blendAmount,
          light: this.#hdrBuffer.color[0],
          lightScale: this.#fullscreenScale,
          // @ts-ignore
          position: this.#gBuffer.color[this.#gBufferPass.outputLocs.position],
          previousLight: this.#reprojectBackBuffer.color[0],
          previousLightScale: this.#previewSize.scale,
          // @ts-ignore
          previousPosition: this.#gBufferBack.color[this.#gBufferPass.outputLocs.position]
        })
        this.#reprojectBuffer.unbind()

        this.toneMapToScreen(this.#reprojectBuffer.color[0], this.#fullscreenScale)
      } else {
        this.toneMapToScreen(this.#hdrBuffer.color[0], this.#fullscreenScale)
      }
    }
  }

  draw(camera: THREE.Camera) {
    if (!this.#ready) return

    if (this.areCamerasEqual(camera, this.#lastCamera)) {
      this.drawTile()
      this.#numPreviewsRendered = 0
      return
    }

    this.setCameras(camera, this.#lastCamera)

    if (this.#firstFrame) {
      this.#firstFrame = false
    } else {
      this.drawPreview()
      this.#numPreviewsRendered++
    }

    this.#tileRender.reset()
    this.#sampleCount = 0
  }

  // debug draw call to measure performance
  // use full resolution buffers every frame
  // reproject every frame
  drawFull(camera: THREE.Camera) {
    if (!this.#ready) {
      return
    }

    this.swapGBuffer()
    this.swapReprojectBuffer()

    if (!this.areCamerasEqual(camera, this.#lastCamera)) {
      this.#sampleCount = 0
      this.clearBuffer(this.#hdrBuffer)
    } else {
      this.#sampleCount++
    }

    this.setCameras(camera, this.#lastCamera)
    this.updateSeed(this.#screenWidth, this.#screenHeight, true)
    this.renderGBuffer()
    this.#rayTracePass.bindTextures()
    this.addSampleToBuffer(this.#hdrBuffer, this.#screenWidth, this.#screenHeight)
    this.#reprojectBuffer.bind()
    this.#gl.viewport(0, 0, this.#screenWidth, this.#screenHeight)
    this.#reprojectPass = this.#reprojectPass.draw(this.#gl, {
      blendAmount: 1.0,
      light: this.#hdrBuffer.color[0],
      lightScale: this.#fullscreenScale,
      // @ts-ignore
      position: this.#gBuffer.color[this.#gBufferPass.outputLocs.position],
      previousLight: this.#lastToneMappedTexture,
      previousLightScale: this.#lastToneMappedScale,
      // @ts-ignore
      previousPosition: this.#gBufferBack.color[this.#gBufferPass.outputLocs.position]
    })
    this.#reprojectBuffer.unbind()
    this.toneMapToScreen(this.#reprojectBuffer.color[0], this.#fullscreenScale)
  }
}

export { RenderingPipeline }
