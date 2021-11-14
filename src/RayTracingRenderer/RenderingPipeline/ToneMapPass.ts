import fragment from './glsl/toneMap.frag.js'
import { makeRenderPass } from '../RenderPass'
import * as THREE from 'three'

const toneMapFunctions = {
  [THREE.LinearToneMapping]: 'linear',
  [THREE.ReinhardToneMapping]: 'reinhard',
  [THREE.Uncharted2ToneMapping]: 'uncharted2',
  [THREE.CineonToneMapping]: 'cineon',
  // @ts-ignore
  [THREE.ACESFilmicToneMapping]: 'acesFilmic'
}

// @ts-ignore
function makeToneMapPass(gl: WebGL2RenderingContext, params) {
  const { fullscreenQuad, toneMappingParams } = params

  const renderPassConfig = {
    gl,
    defines: {
      TONE_MAPPING: toneMapFunctions[toneMappingParams.toneMapping] || 'linear',
      WHITE_POINT: toneMappingParams.whitePoint.toExponential(), // toExponential allows integers to be represented as GLSL floats
      EXPOSURE: toneMappingParams.exposure.toExponential(),
      EDGE_PRESERVING_UPSCALE: true
    },
    vertex: fullscreenQuad.vertexShader,
    fragment
  }

  const renderPassUpscale = makeRenderPass(gl, renderPassConfig)

  renderPassConfig.defines.EDGE_PRESERVING_UPSCALE = false
  const renderPassNative = makeRenderPass(gl, renderPassConfig)

  // @ts-ignore
  function draw(params) {
    const { light, lightScale, position } = params

    const renderPass = lightScale.x !== 1 && lightScale.y !== 1 ? renderPassUpscale : renderPassNative

    if (!renderPass) {
      return
    }

    renderPass.setUniform('lightScale', lightScale.x, lightScale.y)
    renderPass.setTexture('lightTex', light)
    renderPass.setTexture('positionTex', position)

    renderPass.useProgram()
    fullscreenQuad.draw()
  }

  return {
    draw
  }
}

class ToneMapPass {
  draw: (params: any) => void

  constructor(gl: WebGL2RenderingContext, params: any) {
    this.draw = makeToneMapPass(gl, params).draw
  }
}

export { ToneMapPass }
