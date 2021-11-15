import { cloneCase } from '../utils'

function getUniformBlockInfo(gl: WebGL2RenderingContext, program: WebGLProgram, blockIndex: number) {
  const indices = gl.getActiveUniformBlockParameter(program, blockIndex, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES)
  const offset = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET)
  const stride = gl.getActiveUniforms(program, indices, gl.UNIFORM_ARRAY_STRIDE)

  const uniforms = {}
  for (let i = 0; i < indices.length; i++) {
    const activeUniform = gl.getActiveUniform(program, indices[i])
    if (!activeUniform) {
      continue
    }
    const { name, type, size } = activeUniform
    // @ts-ignore
    uniforms[name] = {
      type,
      size,
      offset: offset[i],
      stride: stride[i]
    }
  }

  return uniforms
}

function setData(
  dataView: DataView,
  setter: string,
  size: number,
  offset: number,
  stride: number,
  components: number,
  value: any
) {
  const l = Math.min(value.length / components, size)
  for (let i = 0; i < l; i++) {
    for (let k = 0; k < components; k++) {
      // @ts-ignore
      dataView[setter](offset + i * stride + k * 4, value[components * i + k], true)
    }
  }
}

class UniformBuffer {
  blockIndex: number = 0
  blockSize: number = 0
  uniforms = {}
  buffer: any
  data: DataView | null = null

  static createFromGl(gl: WebGL2RenderingContext, program: WebGLProgram, blockName: string) {
    const newUniformBuffer = new UniformBuffer()

    newUniformBuffer.blockIndex = gl.getUniformBlockIndex(program, blockName)
    newUniformBuffer.blockSize = gl.getActiveUniformBlockParameter(
      program,
      newUniformBuffer.blockIndex,
      gl.UNIFORM_BLOCK_DATA_SIZE
    )

    newUniformBuffer.uniforms = getUniformBlockInfo(gl, program, newUniformBuffer.blockIndex)

    newUniformBuffer.buffer = gl.createBuffer()
    gl.bindBuffer(gl.UNIFORM_BUFFER, newUniformBuffer.buffer)
    gl.bufferData(gl.UNIFORM_BUFFER, newUniformBuffer.blockSize, gl.STATIC_DRAW)

    newUniformBuffer.data = new DataView(new ArrayBuffer(newUniformBuffer.blockSize))

    return newUniformBuffer
  }

  set(gl: WebGL2RenderingContext, name: string, value: any[]) {
    if (!(this.uniforms as any)[name]) throw new Error(`No uniform property with name ${name}`)

    const newUniformBuffer = this.clone()

    if (newUniformBuffer.data === null) throw new Error('newUniformBuffer.data === null')

    const { type, size, offset, stride } = (this.uniforms as any)[name]

    switch (type) {
      case gl.FLOAT:
        setData(newUniformBuffer.data, 'setFloat32', size, offset, stride, 1, value)
        break
      case gl.FLOAT_VEC2:
        setData(newUniformBuffer.data, 'setFloat32', size, offset, stride, 2, value)
        break
      case gl.FLOAT_VEC3:
        setData(newUniformBuffer.data, 'setFloat32', size, offset, stride, 3, value)
        break
      case gl.FLOAT_VEC4:
        setData(newUniformBuffer.data, 'setFloat32', size, offset, stride, 4, value)
        break
      case gl.INT:
        setData(newUniformBuffer.data, 'setInt32', size, offset, stride, 1, value)
        break
      case gl.INT_VEC2:
        setData(newUniformBuffer.data, 'setInt32', size, offset, stride, 2, value)
        break
      case gl.INT_VEC3:
        setData(newUniformBuffer.data, 'setInt32', size, offset, stride, 3, value)
        break
      case gl.INT_VEC4:
        setData(newUniformBuffer.data, 'setInt32', size, offset, stride, 4, value)
        break
      case gl.BOOL:
        setData(newUniformBuffer.data, 'setUint32', size, offset, stride, 1, value)
        break
      default:
        console.warn('UniformBuffer: Unsupported type')
    }

    return newUniformBuffer
  }

  clone() {
    return cloneCase(UniformBuffer, this)
  }

  bind(gl: WebGL2RenderingContext, index: number) {
    const newUniformBuffer = this.clone()
    if (newUniformBuffer.data === null) throw new Error('this.data === null')
    gl.bindBuffer(gl.UNIFORM_BUFFER, newUniformBuffer.buffer)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, newUniformBuffer.data)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, index, newUniformBuffer.buffer)
    return newUniformBuffer
  }
}

export { UniformBuffer }
