import { makeRenderPass, RenderPass } from '../RenderPass'
import vertex from './glsl/gBuffer.vert.js'
import fragment from './glsl/gBuffer.frag.js'
import { Matrix4 } from 'three'

// @ts-ignore
const uploadAttributes = (gl: WebGL2RenderingContext, renderPass: RenderPass, geometry) => {
  // @ts-ignore
  setAttribute(gl, renderPass.attribLocs.aPosition, geometry.getAttribute('position'))
  // @ts-ignore
  setAttribute(gl, renderPass.attribLocs.aNormal, geometry.getAttribute('normal'))
  // @ts-ignore
  setAttribute(gl, renderPass.attribLocs.aUv, geometry.getAttribute('uv'))
  // @ts-ignore
  setAttribute(gl, renderPass.attribLocs.aMaterialMeshIndex, geometry.getAttribute('materialMeshIndex'))

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.getIndex().array, gl.STATIC_DRAW)
}

// @ts-ignore
const setAttribute = (gl: WebGL2RenderingContext, location, bufferAttribute) => {
  if (location === undefined) {
    return
  }

  const { itemSize, array } = bufferAttribute

  gl.enableVertexAttribArray(location)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW)

  if (array instanceof Float32Array) {
    gl.vertexAttribPointer(location, itemSize, gl.FLOAT, false, 0, 0)
  } else if (array instanceof Int32Array) {
    gl.vertexAttribIPointer(location, itemSize, gl.INT, 0, 0)
  } else {
    throw 'Unsupported buffer type'
  }
}

interface GBufferPassProps {
  gl: WebGL2RenderingContext
  materialBuffer: any
  mergedMesh: any
}
class GBufferPass {
  #renderPass: RenderPass
  #gl: WebGL2RenderingContext
  #geometry: any
  #elementCount: any
  #vao: WebGLVertexArrayObject
  #jitterX: number
  #jitterY: number
  #currentCamera: THREE.Camera | null = null
  #projView: Matrix4

  get outputLocs() {
    return this.#renderPass.outputLocs
  }

  set outputLocs(outputLocs: any) {
    this.#renderPass.outputLocs = outputLocs
  }

  constructor({ gl, materialBuffer, mergedMesh }: GBufferPassProps) {
    this.#gl = gl
    this.#renderPass = makeRenderPass(gl, {
      defines: materialBuffer.defines,
      vertex,
      fragment
    })

    this.#renderPass.setTexture('diffuseMap', materialBuffer.textures.diffuseMap)
    this.#renderPass.setTexture('normalMap', materialBuffer.textures.normalMap)
    this.#renderPass.setTexture('pbrMap', materialBuffer.textures.pbrMap)

    this.#geometry = mergedMesh.geometry

    this.#elementCount = this.#geometry.getIndex().count

    const _vao = gl.createVertexArray()

    if (_vao === null) throw new Error('gl.createVertexArray() === null')

    this.#vao = _vao

    gl.bindVertexArray(this.#vao)
    uploadAttributes(gl, this.#renderPass, this.#geometry)
    gl.bindVertexArray(null)

    this.#jitterX = 0
    this.#jitterY = 0

    this.#projView = new Matrix4()
  }
  private calcCamera() {
    if (this.#currentCamera === null) {
      throw new Error('this.currentCamera === null')
    }
    this.#projView.copy(this.#currentCamera.projectionMatrix)

    this.#projView.elements[8] += 2 * this.#jitterX
    this.#projView.elements[9] += 2 * this.#jitterY

    this.#projView.multiply(this.#currentCamera.matrixWorldInverse)
    this.#renderPass.setUniform('projView', this.#projView.elements)
  }
  setJitter(x: number, y: number) {
    this.#jitterX = x
    this.#jitterY = y
  }
  setCamera(camera: THREE.Camera) {
    this.#currentCamera = camera
  }
  draw() {
    this.calcCamera()
    this.#gl.bindVertexArray(this.#vao)
    this.#renderPass.useProgram()
    this.#gl.enable(this.#gl.DEPTH_TEST)
    this.#gl.drawElements(this.#gl.TRIANGLES, this.#elementCount, this.#gl.UNSIGNED_INT, 0)
    this.#gl.disable(this.#gl.DEPTH_TEST)
  }
}

export { GBufferPass }
