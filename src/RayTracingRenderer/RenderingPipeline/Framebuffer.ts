interface MakeFramebufferParams {
  color: {
    [key: string]: {
      target: number
      texture: WebGLTexture
    }
  }
  depth?: {
    target: number
    texture: WebGLRenderbuffer
  }
}

function makeFramebuffer(gl: WebGL2RenderingContext, { color, depth }: MakeFramebufferParams) {
  const framebuffer = gl.createFramebuffer()

  function bind() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  }

  function unbind() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  function init() {
    bind()

    const drawBuffers = []

    for (const locationStr in color) {
      const location = Number(locationStr)

      if (location === undefined) {
        console.error('invalid location')
      }

      const tex = color[location]
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + location, tex.target, tex.texture, 0)
      drawBuffers.push(gl.COLOR_ATTACHMENT0 + location)
    }

    gl.drawBuffers(drawBuffers)

    if (depth) {
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, depth.target, depth.texture)
    }

    unbind()
  }

  init()

  return {
    color,
    bind,
    unbind
  }
}

export { makeFramebuffer, MakeFramebufferParams }
