import { bvhAccel, flattenBvh } from './bvhAccel'
import { generateEnvMapFromSceneComponents, generateBackgroundMapFromSceneBackground } from '../../envMapCreation'
import { envMapDistribution } from '../../envMapDistribution'
import fragment from '../glsl/rayTrace.frag.js'
import { RenderPass } from '../../RenderPass'
import { makeStratifiedSamplerCombined } from '../../StratifiedSamplerCombined'
import { clamp } from '../../util'
import { FullscreenQuad } from '../FullscreenQuad'
import { TextureAPI } from '../Texture'

function makeRayTracePass(
  gl: WebGL2RenderingContext,
  {
    bounces, // number of global illumination bounces
    decomposedScene,
    fullscreenQuad,
    materialBuffer,
    mergedMesh,
    optionalExtensions
  }: {
    bounces: number
    decomposedScene: any
    fullscreenQuad: FullscreenQuad
    materialBuffer:
      | {
          defines: {
            NUM_MATERIALS: any
            NUM_DIFFUSE_MAPS: number
            NUM_NORMAL_MAPS: number
            NUM_DIFFUSE_NORMAL_MAPS: number
            NUM_PBR_MAPS: number
          }
          textures:
            | {
                pbrMap: { target: number; texture: WebGLTexture }
                normalMap: { target: number; texture: WebGLTexture }
                diffuseMap: { target: number; texture: WebGLTexture }
              }
            | {
                pbrMap?: undefined
                normalMap: { target: number; texture: WebGLTexture }
                diffuseMap: { target: number; texture: WebGLTexture }
              }
            | {
                pbrMap: { target: number; texture: WebGLTexture }
                normalMap?: undefined
                diffuseMap: { target: number; texture: WebGLTexture }
              }
            | { pbrMap?: undefined; normalMap?: undefined; diffuseMap: { target: number; texture: WebGLTexture } }
            | {
                pbrMap: { target: number; texture: WebGLTexture }
                normalMap: { target: number; texture: WebGLTexture }
                diffuseMap?: undefined
              }
            | { pbrMap?: undefined; normalMap: { target: number; texture: WebGLTexture }; diffuseMap?: undefined }
            | { pbrMap: { target: number; texture: WebGLTexture }; normalMap?: undefined; diffuseMap?: undefined }
            | { pbrMap?: undefined; normalMap?: undefined; diffuseMap?: undefined }
        }
      | undefined
    mergedMesh: any
    optionalExtensions: string[]
  }
) {
  bounces = clamp(bounces, 1, 6)

  const samplingDimensions: number[] = []

  for (let i = 1; i <= bounces; i++) {
    // specular or diffuse reflection, light importance sampling, next path direction
    samplingDimensions.push(2, 2, 2)
    if (i >= 2) {
      // russian roulette sampling
      // this step is skipped on the first bounce
      samplingDimensions.push(1)
    }
  }

  let samples: { next: any; strataCount: any; restart: any }

  let renderPass = makeRenderPassFromScene({
    bounces,
    decomposedScene,
    fullscreenQuad,
    gl,
    materialBuffer,
    mergedMesh,
    optionalExtensions,
    samplingDimensions
  })

  function setSize(width: number, height: number) {
    renderPass = renderPass.setUniform('pixelSize', 1 / width, 1 / height)
  }

  // noiseImage is a 32-bit PNG image
  function setNoise(noiseImage: any) {
    renderPass = renderPass.setTexture(
      'noiseTex',
      TextureAPI.new(gl, {
        data: noiseImage,
        wrapS: gl.REPEAT,
        wrapT: gl.REPEAT,
        storage: 'halfFloat'
      })
    )
  }

  function setCamera(camera: { matrixWorld: { elements: any }; aspect: any; fov: number }) {
    renderPass = renderPass
      .setUniform('camera.transform', camera.matrixWorld.elements)
      .setUniform('camera.aspect', camera.aspect)
      .setUniform('camera.fov', 0.5 / Math.tan((0.5 * Math.PI * camera.fov) / 180))
  }

  function setJitter(x: any, y: any) {
    renderPass = renderPass.setUniform('jitter', x, y)
  }

  function setGBuffers({
    position,
    normal,
    faceNormal,
    color,
    matProps
  }: {
    position: any
    normal: any
    faceNormal: any
    color: any
    matProps: any
  }) {
    renderPass = renderPass
      .setTexture('gPosition', position)
      .setTexture('gNormal', normal)
      .setTexture('gFaceNormal', faceNormal)
      .setTexture('gColor', color)
      .setTexture('gMatProps', matProps)
  }

  function nextSeed() {
    renderPass = renderPass.setUniform('stratifiedSamples[0]', samples.next())
  }

  function setStrataCount(strataCount: number) {
    if (strataCount > 1 && strataCount !== samples.strataCount) {
      // reinitailizing random has a performance cost. we can skip it if
      // * strataCount is 1, since a strataCount of 1 works with any sized StratifiedRandomCombined
      // * random already has the same strata count as desired
      samples = makeStratifiedSamplerCombined(strataCount, samplingDimensions)
    } else {
      samples.restart()
    }

    renderPass = renderPass.setUniform('strataSize', 1.0 / strataCount)
    nextSeed()
  }

  function bindTextures() {
    renderPass = renderPass.bindTextures(gl)
  }

  function draw() {
    renderPass = renderPass.useProgram(gl, false)
    fullscreenQuad = fullscreenQuad.draw(gl)
  }

  samples = makeStratifiedSamplerCombined(1, samplingDimensions)

  return {
    bindTextures,
    draw,
    nextSeed,
    outputLocs: renderPass.outputLocs,
    setCamera,
    setJitter,
    setGBuffers,
    setNoise,
    setSize,
    setStrataCount
  }
}

interface RenderPassFromSceneProp {
  bounces: any
  decomposedScene: any
  fullscreenQuad: any
  gl: WebGL2RenderingContext
  materialBuffer: any
  mergedMesh: any
  optionalExtensions: any
  samplingDimensions: any
}

function makeRenderPassFromScene({
  bounces,
  decomposedScene,
  fullscreenQuad,
  gl,
  materialBuffer,
  mergedMesh,
  optionalExtensions,
  samplingDimensions
}: RenderPassFromSceneProp) {
  const { OES_texture_float_linear } = optionalExtensions

  const { background, directionalLights, ambientLights, environmentLights } = decomposedScene

  const { geometry, materials } = mergedMesh

  // create bounding volume hierarchy from a static scene
  const bvh = bvhAccel(geometry)
  const flattenedBvh = flattenBvh(bvh)
  const numTris = geometry.index.count / 3

  let renderPass = RenderPass.createFromGl(gl, {
    defines: {
      OES_texture_float_linear,
      BVH_COLUMNS: textureDimensionsFromArray(flattenedBvh.count).columnsLog,
      INDEX_COLUMNS: textureDimensionsFromArray(numTris).columnsLog,
      VERTEX_COLUMNS: textureDimensionsFromArray(geometry.attributes.position.count).columnsLog,
      STACK_SIZE: flattenedBvh.maxDepth,
      BOUNCES: bounces,
      USE_GLASS: materials.some((m: any) => m.transparent),
      USE_SHADOW_CATCHER: materials.some((m: any) => m.shadowCatcher),
      SAMPLING_DIMENSIONS: samplingDimensions.reduce((a: any, b: any) => a + b),
      ...materialBuffer.defines
    },
    fragment,
    vertex: fullscreenQuad.vertexShader
  })

  renderPass = renderPass
    .setTexture('diffuseMap', materialBuffer.textures.diffuseMap)
    .setTexture('normalMap', materialBuffer.textures.normalMap)
    .setTexture('pbrMap', materialBuffer.textures.pbrMap)
    .setTexture('positionBuffer', makeDataTexture(gl, geometry.getAttribute('position').array, 3))
    .setTexture('normalBuffer', makeDataTexture(gl, geometry.getAttribute('normal').array, 3))
    .setTexture('uvBuffer', makeDataTexture(gl, geometry.getAttribute('uv').array, 2))
    .setTexture('bvhBuffer', makeDataTexture(gl, flattenedBvh.buffer, 4))

  const envImage = generateEnvMapFromSceneComponents(directionalLights, ambientLights, environmentLights)
  const envImageTextureObject = TextureAPI.new(gl, {
    data: envImage.data,
    storage: 'halfFloat',
    minFilter: OES_texture_float_linear ? gl.LINEAR : gl.NEAREST,
    magFilter: OES_texture_float_linear ? gl.LINEAR : gl.NEAREST,
    width: envImage.width,
    height: envImage.height
  })

  renderPass = renderPass.setTexture('envMap', envImageTextureObject)

  let backgroundImageTextureObject
  if (background) {
    const backgroundImage = generateBackgroundMapFromSceneBackground(background)

    if (backgroundImage === undefined) throw new Error('backgroundImage === undefined')

    backgroundImageTextureObject = TextureAPI.new(gl, {
      data: backgroundImage.data,
      storage: 'halfFloat',
      minFilter: OES_texture_float_linear ? gl.LINEAR : gl.NEAREST,
      magFilter: OES_texture_float_linear ? gl.LINEAR : gl.NEAREST,
      width: backgroundImage.width,
      height: backgroundImage.height
    })
  } else {
    backgroundImageTextureObject = envImageTextureObject
  }

  renderPass = renderPass.setTexture('backgroundMap', backgroundImageTextureObject)

  const distribution = envMapDistribution(envImage)

  renderPass = renderPass.setTexture(
    'envMapDistribution',
    TextureAPI.new(gl, {
      data: distribution.data,
      storage: 'halfFloat',
      width: distribution.width,
      height: distribution.height
    })
  )

  return renderPass
}

function textureDimensionsFromArray(count: number) {
  const columnsLog = Math.round(Math.log2(Math.sqrt(count)))
  const columns = 2 ** columnsLog
  const rows = Math.ceil(count / columns)
  return {
    columnsLog,
    columns,
    rows,
    size: rows * columns
  }
}

function makeDataTexture(gl: WebGL2RenderingContext, dataArray: any, channels: 1 | 2 | 3 | 4) {
  const textureDim = textureDimensionsFromArray(dataArray.length / channels)
  return TextureAPI.new(gl, {
    data: padArray(dataArray, channels * textureDim.size),
    width: textureDim.columns,
    height: textureDim.rows
  })
}

// expand array to the given length
function padArray(typedArray: any, length: number) {
  const newArray = new typedArray.constructor(length)
  newArray.set(typedArray)
  return newArray
}

export { makeRayTracePass }
