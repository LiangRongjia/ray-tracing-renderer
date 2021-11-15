import fragment from './glsl/toneMap.frag.js'
import { RenderPass } from '../RenderPass'
import * as THREE from 'three'
import { FullscreenQuad } from './FullscreenQuad.js'

const toneMapFunctions = {
  [THREE.LinearToneMapping]: 'linear',
  [THREE.ReinhardToneMapping]: 'reinhard',
  [THREE.Uncharted2ToneMapping]: 'uncharted2',
  [THREE.CineonToneMapping]: 'cineon',
  // @ts-ignore
  [THREE.ACESFilmicToneMapping]: 'acesFilmic'
}

// @ts-ignore
function makeToneMapPass(
  gl: WebGL2RenderingContext,
  params: { fullscreenQuad: FullscreenQuad; toneMappingParams: any }
) {
  let { fullscreenQuad, toneMappingParams } = params

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

  let renderPassUpscale = RenderPass.createFromGl(gl, renderPassConfig)

  renderPassConfig.defines.EDGE_PRESERVING_UPSCALE = false
  let renderPassNative = RenderPass.createFromGl(gl, renderPassConfig)

  // @ts-ignore
  function draw(params) {
    const { light, lightScale, position } = params

    const renderPass = lightScale.x !== 1 && lightScale.y !== 1 ? renderPassUpscale : renderPassNative

    if (!renderPass) {
      return
    }

    const newRenderPass = renderPass
      .setUniform('lightScale', lightScale.x, lightScale.y)
      .setTexture('lightTex', light)
      .setTexture('positionTex', position)
      .useProgram(gl)

    lightScale.x !== 1 && lightScale.y !== 1 ? (renderPassUpscale = newRenderPass) : (renderPassNative = newRenderPass)

    fullscreenQuad = fullscreenQuad.draw(gl)
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
