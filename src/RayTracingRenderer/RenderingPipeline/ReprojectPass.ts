import fragment from './glsl/reproject.frag.js'
import { RenderPass } from '../RenderPass'
import * as THREE from 'three'
import { cloneCase } from '../../utils.js'

class ReprojectPass {
  fullscreenQuad: any = null
  maxReprojectedSamples: any = null
  renderPass: RenderPass | null = null
  historyCamera: THREE.Matrix4 = new THREE.Matrix4()

  setJitter(x: number, y: number) {
    if (this.renderPass === null) throw new Error('this.renderPass === null')
    this.renderPass = this.renderPass.setUniform('jitter', x, y)
    return this
  }

  draw(gl: WebGL2RenderingContext, params: any) {
    if (this.renderPass === null) throw new Error('this.renderPass === null')
    const { blendAmount, light, lightScale, position, previousLight, previousLightScale, previousPosition } = params
    this.renderPass = this.renderPass
      .setUniform('blendAmount', blendAmount)
      .setUniform('lightScale', lightScale.x, lightScale.y)
      .setUniform('previousLightScale', previousLightScale.x, previousLightScale.y)
      .setTexture('lightTex', light)
      .setTexture('positionTex', position)
      .setTexture('previousLightTex', previousLight)
      .setTexture('previousPositionTex', previousPosition)
      .useProgram(gl)
    this.fullscreenQuad.draw()
    return this
  }

  clone() {
    return cloneCase(ReprojectPass, this)
  }

  setPreviousCamera(camera: THREE.Camera) {
    const newReprojectPass = this.clone()
    if (newReprojectPass.renderPass === null) throw new Error('this.renderPass === null')
    newReprojectPass.historyCamera.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    newReprojectPass.renderPass = newReprojectPass.renderPass.setUniform(
      'historyCamera',
      newReprojectPass.historyCamera.elements
    )
    return newReprojectPass
  }

  static createWithGl(gl: WebGL2RenderingContext, params: { fullscreenQuad: any; maxReprojectedSamples: any }) {
    const newReprojectPass = new ReprojectPass()
    newReprojectPass.fullscreenQuad = params.fullscreenQuad
    newReprojectPass.maxReprojectedSamples = params.maxReprojectedSamples
    newReprojectPass.renderPass = RenderPass.createFromGl(gl, {
      defines: {
        MAX_SAMPLES: newReprojectPass.maxReprojectedSamples.toFixed(1)
      },
      vertex: newReprojectPass.fullscreenQuad.vertexShader,
      fragment
    })

    newReprojectPass.historyCamera = new THREE.Matrix4()
    return newReprojectPass
  }
}

export { ReprojectPass }
