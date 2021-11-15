import { cloneCase } from '../utils'
import { compileShader, createProgram, getAttributes } from './glUtil'
import { Texture } from './RenderingPipeline/Texture'
import { makeUniformSetter } from './UniformSetter'

interface CreateRenderPassFromGlParams {
  defines: any
  vertex: WebGLShader
  fragment: WebGLShader & { outputs: any }
}

class RenderPass {
  outputLocs: any = {}
  attribLocs: any = {}
  program: WebGLProgram | null = null
  textures: any = {}
  nextTexUnit: number = 0
  uniformSetter: any

  static createFromGl(gl: WebGL2RenderingContext, params: CreateRenderPassFromGlParams) {
    const { fragment, vertex } = params
    const vertexCompiled = vertex instanceof WebGLShader ? vertex : makeVertexShader(gl, params)
    const fragmentCompiled = fragment instanceof WebGLShader ? fragment : makeFragmentShader(gl, params)
    const program = createProgram(gl, vertexCompiled, fragmentCompiled)
    const newRenderPass = createFromProgram(gl, program)
    newRenderPass.outputLocs = fragment.outputs ? getOutputLocations(fragment.outputs) : {}
    return newRenderPass
  }

  clone() {
    return cloneCase(RenderPass, this)
  }

  bindTextures(gl: WebGL2RenderingContext) {
    for (let name in this.textures) {
      const { tex, unit } = (this.textures as any)[name]
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(tex.target, tex.texture)
    }
    return this
  }

  setTexture(name: string, texture: Texture) {
    if (!texture) throw new Error('!texture')

    const newRenderPass = this.clone()

    if (!(newRenderPass.textures as any)[name]) {
      const unit = newRenderPass.nextTexUnit++

      newRenderPass.uniformSetter.setUniform(name, unit)
      ;(newRenderPass.textures as any)[name] = {
        unit,
        tex: texture
      }
    } else {
      ;(newRenderPass.textures as any)[name].tex = texture
    }
    return newRenderPass
  }

  setUniform(name: any, ...unit: any[]) {
    this.uniformSetter.setUniform(name, ...unit)
    return this
  }

  useProgram(gl: WebGL2RenderingContext, autoBindTextures: boolean = true) {
    gl.useProgram(this.program)
    this.uniformSetter.upload()
    if (autoBindTextures) {
      return this.bindTextures(gl)
    }
    return this
  }
}

function makeVertexShader(gl: WebGL2RenderingContext, { defines, vertex }: { defines: any; vertex: any }) {
  return makeShaderStage(gl, gl.VERTEX_SHADER, vertex, defines)
}

function makeFragmentShader(gl: WebGL2RenderingContext, { defines, fragment }: { defines: any; fragment: any }) {
  return makeShaderStage(gl, gl.FRAGMENT_SHADER, fragment, defines)
}

function createFromProgram(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const uniformSetter = makeUniformSetter(gl, program)

  const newRenderPass = new RenderPass()

  newRenderPass.attribLocs = getAttributes(gl, program)
  newRenderPass.program = program
  newRenderPass.textures = {}
  newRenderPass.nextTexUnit = 1
  newRenderPass.uniformSetter = uniformSetter

  return newRenderPass
}

function makeShaderStage(gl: WebGL2RenderingContext, type: number, shader: any, defines: any) {
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

function addDefines(defines: any) {
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

function addOutputs(outputs: any) {
  let str = ''

  const locations = getOutputLocations(outputs)

  for (let name in locations) {
    const location = (locations as any)[name]
    str += `layout(location = ${location}) out vec4 out_${name};\n`
  }

  return str
}

function addIncludes(includes: any, defines: any) {
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
    ;(locations as any)[outputs[i]] = i
  }

  return locations
}

export { makeVertexShader, makeFragmentShader, RenderPass }
