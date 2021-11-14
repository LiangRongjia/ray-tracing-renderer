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
  fullWidth: number = NaN
  fullHeight: number = NaN
  renderWidth: number = NaN
  renderHeight: number = NaN
  pixelsPerFrame: number = NaN
  scale = new Vector2(1, 1)

  setSize(w: number, h: number) {
    return RenderSize.setSize(this, w, h)
  }

  adjustSize(elapsedFrameMs: number) {
    return RenderSize.adjustSize(this, elapsedFrameMs)
  }

  static createWithGl(gl: WebGL2RenderingContext) {
    const renderSize = new RenderSize()
    renderSize.pixelsPerFrame = pixelsPerFrameEstimate(gl)
    return renderSize
  }

  static clone(renderSize: RenderSize) {
    const newRenderSizeData = new RenderSize()
    // @ts-ignore
    Object.keys(renderSize).forEach((key: keyof RenderSize) => (newRenderSizeData[key] = renderSize[key]))
    return newRenderSizeData
  }

  static calcDimensions(renderSize: RenderSize) {
    const data = RenderSize.clone(renderSize)
    const aspectRatio = data.fullWidth / data.fullHeight
    data.renderWidth = Math.round(clamp(Math.sqrt(data.pixelsPerFrame * aspectRatio), 1, data.fullWidth))
    data.renderHeight = Math.round(clamp(data.renderWidth / aspectRatio, 1, data.fullHeight))
    data.scale.set(data.renderWidth / data.fullWidth, data.renderHeight / data.fullHeight)
    return data
  }

  static setSize(renderSize: RenderSize, w: number, h: number) {
    const newRenderSize = RenderSize.clone(renderSize)
    newRenderSize.fullWidth = w
    newRenderSize.fullHeight = h
    return RenderSize.calcDimensions(newRenderSize)
  }

  static adjustSize(renderSize: RenderSize, elapsedFrameMs: number) {
    const data = RenderSize.clone(renderSize)
    if (!elapsedFrameMs) return null
    // tweak to find balance. higher = faster convergence, lower = less fluctuations to microstutters
    const strength = 600
    const error = desiredMsPerFrame - elapsedFrameMs
    data.pixelsPerFrame += strength * error
    data.pixelsPerFrame = clamp(data.pixelsPerFrame, 8192, data.fullWidth * data.fullHeight)
    return RenderSize.calcDimensions(data)
  }
}

export { RenderSize }
