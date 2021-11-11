import fragment from './glsl/reproject.frag.js'
import { makeRenderPass, RenderPass } from '../RenderPass'
import * as THREE from 'three'

class ReprojectPass {
  #fullscreenQuad: any
  #maxReprojectedSamples: any
  #renderPass: RenderPass
  #historyCamera: THREE.Matrix4

  constructor(gl: WebGL2RenderingContext, params: { fullscreenQuad: any; maxReprojectedSamples: any }) {
    this.#fullscreenQuad = params.fullscreenQuad
    this.#maxReprojectedSamples = params.maxReprojectedSamples
    this.#renderPass = makeRenderPass(gl, {
      defines: {
        MAX_SAMPLES: this.#maxReprojectedSamples.toFixed(1)
      },
      vertex: this.#fullscreenQuad.vertexShader,
      fragment
    })

    this.#historyCamera = new THREE.Matrix4()
  }

  setPreviousCamera(camera: THREE.Camera) {
    this.#historyCamera.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)

    this.#renderPass.setUniform('historyCamera', this.#historyCamera.elements)
  }

  setJitter(x: number, y: number) {
    this.#renderPass.setUniform('jitter', x, y)
  }

  // @ts-ignore
  draw(params) {
    const { blendAmount, light, lightScale, position, previousLight, previousLightScale, previousPosition } = params

    this.#renderPass.setUniform('blendAmount', blendAmount)
    this.#renderPass.setUniform('lightScale', lightScale.x, lightScale.y)
    this.#renderPass.setUniform('previousLightScale', previousLightScale.x, previousLightScale.y)

    this.#renderPass.setTexture('lightTex', light)
    this.#renderPass.setTexture('positionTex', position)
    this.#renderPass.setTexture('previousLightTex', previousLight)
    this.#renderPass.setTexture('previousPositionTex', previousPosition)

    this.#renderPass.useProgram()
    this.#fullscreenQuad.draw()
  }
}

export { ReprojectPass }
