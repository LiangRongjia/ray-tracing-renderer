import { compileShader, createProgram, getAttributes } from './glUtil'
import { makeUniformSetter } from './UniformSetter'

function makeRenderPass(
  gl: WebGL2RenderingContext,
  params: {
    defines: any
    vertex: any
    fragment: {
      outputs: any
    }
  }
) {
  const { fragment, vertex } = params

  const vertexCompiled = vertex instanceof WebGLShader ? vertex : makeVertexShader(gl, params)

  const fragmentCompiled = fragment instanceof WebGLShader ? fragment : makeFragmentShader(gl, params)

  if (!vertexCompiled || !fragmentCompiled) {
    return
  }

  const program = createProgram(gl, vertexCompiled, fragmentCompiled)

  if (!program) {
    return
  }

  return {
    ...makeRenderPassFromProgram(gl, program),
    outputLocs: fragment.outputs ? getOutputLocations(fragment.outputs) : {}
  }
}

//@ts-ignore
function makeVertexShader(gl: WebGL2RenderingContext, { defines, vertex }) {
  return makeShaderStage(gl, gl.VERTEX_SHADER, vertex, defines)
}

//@ts-ignore
function makeFragmentShader(gl: WebGL2RenderingContext, { defines, fragment }) {
  return makeShaderStage(gl, gl.FRAGMENT_SHADER, fragment, defines)
}

function makeRenderPassFromProgram(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const uniformSetter = makeUniformSetter(gl, program)

  const textures = {}

  let nextTexUnit = 1

  //@ts-ignore
  function setTexture(name, texture) {
    if (!texture) {
      return
    }

    //@ts-ignore
    if (!textures[name]) {
      const unit = nextTexUnit++

      //@ts-ignore
      uniformSetter.setUniform(name, unit)

      //@ts-ignore
      textures[name] = {
        unit,
        tex: texture
      }
    } else {
      //@ts-ignore
      textures[name].tex = texture
    }
  }

  function bindTextures() {
    for (let name in textures) {
      //@ts-ignore
      const { tex, unit } = textures[name]
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(tex.target, tex.texture)
    }
  }

  function useProgram(autoBindTextures = true) {
    gl.useProgram(program)
    uniformSetter.upload()
    if (autoBindTextures) {
      bindTextures()
    }
  }

  return {
    attribLocs: getAttributes(gl, program),
    bindTextures,
    program,
    setTexture,
    setUniform: uniformSetter.setUniform,
    textures,
    useProgram
  }
}

//@ts-ignore
function makeShaderStage(gl: WebGL2RenderingContext, type: number, shader, defines) {
  let str = '#version 300 es\nprecision mediump float;\nprecision mediump int;\n'

  if (defines) {
    str += addDefines(defines)
  }

  if (type === gl.FRAGMENT_SHADER && shader.outputs) {
    str += addOutputs(shader.outputs)
  }

  if (shader.includes) {
    str += addIncludes(shader.includes, defines)
  }

  if (typeof shader.source === 'function') {
    str += shader.source(defines)
  } else {
    str += shader.source
  }

  return compileShader(gl, type, str)
}

//@ts-ignore
function addDefines(defines) {
  let str = ''

  for (const name in defines) {
    const value = defines[name]

    // don't define falsy values such as false, 0, and ''.
    // this adds support for #ifdef on falsy values
    if (value) {
      str += `#define ${name} ${value}\n`
    }
  }

  return str
}

//@ts-ignore
function addOutputs(outputs) {
  let str = ''

  const locations = getOutputLocations(outputs)

  for (let name in locations) {
    //@ts-ignore
    const location = locations[name]
    str += `layout(location = ${location}) out vec4 out_${name};\n`
  }

  return str
}

//@ts-ignore
function addIncludes(includes, defines) {
  let str = ''

  for (let include of includes) {
    if (typeof include === 'function') {
      str += include(defines)
    } else {
      str += include
    }
  }

  return str
}

function getOutputLocations(outputs: any[]) {
  let locations = {}

  for (let i = 0; i < outputs.length; i++) {
    //@ts-ignore
    locations[outputs[i]] = i
  }

  return locations
}

export { makeRenderPass, makeVertexShader, makeFragmentShader }
