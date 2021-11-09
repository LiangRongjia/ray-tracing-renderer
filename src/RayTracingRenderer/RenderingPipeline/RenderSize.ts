import { clamp } from '../util'
import { Vector2 } from 'three'

const desiredMsPerFrame = 20

const pixelsPerFrameEstimate = (gl: WebGL2RenderingContext) => {
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)

  if (maxRenderbufferSize <= 8192) {
    return 80000
  } else if (maxRenderbufferSize === 16384) {
    return 150000
  } else if (maxRenderbufferSize >= 32768) {
    return 400000
  }
  return NaN
}

class RenderSize {
  #fullWidth: number = NaN
  #fullHeight: number = NaN
  #renderWidth: number = NaN
  #renderHeight: number = NaN
  #pixelsPerFrame: number
  scale = new Vector2(1, 1)

  get width() {
    return this.#renderWidth
  }

  get height() {
    return this.#renderHeight
  }

  constructor(gl: WebGL2RenderingContext) {
    this.#pixelsPerFrame = pixelsPerFrameEstimate(gl)
  }

  private calcDimensions() {
    const aspectRatio = this.#fullWidth / this.#fullHeight
    if (this.#pixelsPerFrame === undefined) {
      return
    }
    this.#renderWidth = Math.round(clamp(Math.sqrt(this.#pixelsPerFrame * aspectRatio), 1, this.#fullWidth))
    this.#renderHeight = Math.round(clamp(this.#renderWidth / aspectRatio, 1, this.#fullHeight))
    this.scale.set(this.#renderWidth / this.#fullWidth, this.#renderHeight / this.#fullHeight)
  }

  setSize(w: number, h: number) {
    this.#fullWidth = w
    this.#fullHeight = h
    this.calcDimensions()
  }

  adjustSize(elapsedFrameMs: number) {
    if (!elapsedFrameMs) {
      return
    }

    // tweak to find balance. higher = faster convergence, lower = less fluctuations to microstutters
    const strength = 600

    const error = desiredMsPerFrame - elapsedFrameMs

    if (this.#pixelsPerFrame === undefined) {
      return
    }
    this.#pixelsPerFrame += strength * error
    this.#pixelsPerFrame = clamp(this.#pixelsPerFrame, 8192, this.#fullWidth * this.#fullHeight)
    this.calcDimensions()
  }
}

export { RenderSize }
