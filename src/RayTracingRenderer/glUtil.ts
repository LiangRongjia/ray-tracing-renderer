function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)

  if (shader === null) {
    throw new Error('gl.createShader(type) === null')
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)

  if (success) {
    return shader
  }

  const output = source
    .split('\n')
    .map((x, i) => `${i + 1}: ${x}`)
    .join('\n')
  console.log(output)

  throw gl.getShaderInfoLog(shader)
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
  transformVaryings?: string[],
  transformBufferMode?: number
) {
  const program = gl.createProgram()

  if (program === null) {
    throw new Error('gl.createProgram() === null')
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)

  if (transformVaryings && transformBufferMode) {
    gl.transformFeedbackVaryings(program, transformVaryings, transformBufferMode)
  }

  gl.linkProgram(program)

  gl.detachShader(program, vertexShader)
  gl.detachShader(program, fragmentShader)

  const success = gl.getProgramParameter(program, gl.LINK_STATUS)

  if (success) {
    return program
  }

  throw gl.getProgramInfoLog(program)
}

function getUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): {
  [key: string]: {
    type: number
    location: WebGLUniformLocation
  }
} {
  let uniforms = {}

  const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)

  for (let i = 0; i < count; i++) {
    const activeUniform = gl.getActiveUniform(program, i)

    if (!activeUniform) {
      continue
    }

    const { name, type } = activeUniform

    const location = gl.getUniformLocation(program, name)

    if (!location) {
      continue
    }

    uniforms = {
      ...uniforms,
      [name]: {
        type,
        location
      }
    }
  }

  return uniforms as {
    [key: string]: {
      type: number
      location: WebGLUniformLocation
    }
  }
}

function getAttributes(gl: WebGL2RenderingContext, program: WebGLProgram) {
  let attributes = {}

  const count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  for (let i = 0; i < count; i++) {
    const activeAttrib = gl.getActiveAttrib(program, i)

    if (!activeAttrib) {
      continue
    }

    attributes = {
      ...attributes,
      [activeAttrib.name]: gl.getAttribLocation(program, activeAttrib.name)
    }
  }

  return attributes
}

export { compileShader, createProgram, getUniforms, getAttributes }
