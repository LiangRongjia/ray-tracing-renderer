import fragment from './glsl/reproject.frag.js'
import { makeRenderPass, RenderPass } from '../RenderPass'
import * as THREE from 'three'

const cloneCase = <T>(classConstructor: new () => T, target: T & Object) => {
  let newCase = new classConstructor()
  // @ts-ignore
  Object.keys(target).forEach((key: keyof T) => (newCase[key] = target[key]))
  return newCase
}

class ReprojectPass {
  fullscreenQuad: any = null
  maxReprojectedSamples: any = null
  renderPass: RenderPass | null = null
  historyCamera: THREE.Matrix4 = new THREE.Matrix4()

  setJitter(x: number, y: number) {
    if (this.renderPass === null) throw new Error('this.renderPass === null')
    this.renderPass.setUniform('jitter', x, y)
    return this
  }

  // @ts-ignore
  draw(params) {
    if (this.renderPass === null) throw new Error('this.renderPass === null')
    const { blendAmount, light, lightScale, position, previousLight, previousLightScale, previousPosition } = params
    this.renderPass.setUniform('blendAmount', blendAmount)
    this.renderPass.setUniform('lightScale', lightScale.x, lightScale.y)
    this.renderPass.setUniform('previousLightScale', previousLightScale.x, previousLightScale.y)
    this.renderPass.setTexture('lightTex', light)
    this.renderPass.setTexture('positionTex', position)
    this.renderPass.setTexture('previousLightTex', previousLight)
    this.renderPass.setTexture('previousPositionTex', previousPosition)
    this.renderPass.useProgram()
    this.fullscreenQuad.draw()
    return this
  }

  clone() {
    return cloneCase(ReprojectPass, this)
  }

  setPreviousCamera(camera: THREE.Camera) {
    const newReprojectPass = this.clone()
    newReprojectPass.historyCamera.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    newReprojectPass.renderPass?.setUniform('historyCamera', newReprojectPass.historyCamera.elements)
    return newReprojectPass
  }

  static createWithGl(gl: WebGL2RenderingContext, params: { fullscreenQuad: any; maxReprojectedSamples: any }) {
    const newReprojectPass = new ReprojectPass()
    newReprojectPass.fullscreenQuad = params.fullscreenQuad
    newReprojectPass.maxReprojectedSamples = params.maxReprojectedSamples
    newReprojectPass.renderPass = makeRenderPass(gl, {
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
