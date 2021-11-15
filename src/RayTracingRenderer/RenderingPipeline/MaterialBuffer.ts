// @ts-check
import { ThinMaterial, ThickMaterial, ShadowCatcherMaterial } from '../../constants'
import materialBufferChunk from './glsl/chunks/materialBuffer.glsl.js'
import { UniformBuffer } from '../UniformBuffer'
import { RenderPass } from '../RenderPass'
import { Texture } from './Texture'
import { getTexturesFromMaterials, mergeTexturesFromMaterials } from '../texturesFromMaterials'

// @ts-ignore
function makeMaterialBuffer(gl: WebGL2RenderingContext, materials) {
  const maps = getTexturesFromMaterials(materials, ['map', 'normalMap'])
  const pbrMap = mergeTexturesFromMaterials(materials, ['roughnessMap', 'metalnessMap'])

  const mapTextureArray = maps.map.textures.length > 0 ? makeTextureArray(gl, maps.map.textures, true) : null

  const normalMapTextureArray =
    maps.normalMap.textures.length > 0 ? makeTextureArray(gl, maps.normalMap.textures, false) : null

  const pbrMapTextureArray = pbrMap.textures.length > 0 ? makeTextureArray(gl, pbrMap.textures, false) : null

  const bufferData = {
    // @ts-ignore
    color: materials.map((m) => m.color),
    // @ts-ignore
    roughness: materials.map((m) => m.roughness),
    // @ts-ignore
    metalness: materials.map((m) => m.metalness),
    // @ts-ignore
    normalScale: materials.map((m) => m.normalScale),
    // @ts-ignore
    type: materials.map((m) => {
      if (m.shadowCatcher) {
        return ShadowCatcherMaterial
      }
      if (m.transparent) {
        return m.solid ? ThickMaterial : ThinMaterial
      }
    }),
    ...(() => {
      const _diffuseMap =
        mapTextureArray !== null
          ? {
              diffuseMapSize: mapTextureArray.relativeSizes,
              diffuseMapIndex: maps.map.indices
            }
          : {}
      const _normalMap =
        normalMapTextureArray !== null
          ? {
              normalMapSize: normalMapTextureArray.relativeSizes,
              normalMapIndex: maps.normalMap.indices
            }
          : {}
      const _pbrMap =
        pbrMapTextureArray !== null
          ? {
              pbrMapSize: pbrMapTextureArray.relativeSizes,
              roughnessMapIndex: pbrMap.indices.roughnessMap,
              metalnessMapIndex: pbrMap.indices.metalnessMap
            }
          : {}
      return {
        ..._diffuseMap,
        ..._normalMap,
        ..._pbrMap
      }
    })()
  }

  const textures = (() => {
    const _diffuseMap = mapTextureArray !== null ? { diffuseMap: mapTextureArray.texture } : {}
    const _normalMap = normalMapTextureArray !== null ? { normalMap: normalMapTextureArray.texture } : {}
    const _pbrMap = pbrMapTextureArray !== null ? { pbrMap: pbrMapTextureArray.texture } : {}
    return {
      ..._diffuseMap,
      ..._normalMap,
      ..._pbrMap
    }
  })()

  const defines = {
    NUM_MATERIALS: materials.length,
    NUM_DIFFUSE_MAPS: maps.map.textures.length,
    NUM_NORMAL_MAPS: maps.normalMap.textures.length,
    NUM_DIFFUSE_NORMAL_MAPS: Math.max(maps.map.textures.length, maps.normalMap.textures.length),
    NUM_PBR_MAPS: pbrMap.textures.length
  }

  // create temporary shader program including the Material uniform buffer
  // used to query the compiled structure of the uniform buffer
  const renderPass = RenderPass.createFromGl(gl, {
    vertex: {
      source: `void main() {}`
    },
    fragment: {
      // @ts-ignore
      includes: [materialBufferChunk],
      source: `void main() {}`
    },
    defines
  })

  if (renderPass === undefined || renderPass.program === null) return

  uploadToUniformBuffer(gl, renderPass.program, bufferData)

  return { defines, textures }
}

// @ts-ignore
function makeTextureArray(gl: WebGL2RenderingContext, textures, gammaCorrection = false) {
  // @ts-ignore
  const images = textures.map((t) => t.image)
  // @ts-ignore
  const flipY = textures.map((t) => t.flipY)
  const { maxSize, relativeSizes } = maxImageSize(images)

  // create GL Array Texture from individual textures
  const texture = new Texture(gl, {
    width: maxSize.width,
    height: maxSize.height,
    gammaCorrection,
    data: images,
    flipY,
    channels: 3,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR
  })

  return {
    texture,
    relativeSizes
  }
}

// @ts-ignore
function maxImageSize(images) {
  const maxSize = {
    width: 0,
    height: 0
  }

  for (const image of images) {
    maxSize.width = Math.max(maxSize.width, image.width)
    maxSize.height = Math.max(maxSize.height, image.height)
  }

  const relativeSizes = []
  for (const image of images) {
    relativeSizes.push(image.width / maxSize.width)
    relativeSizes.push(image.height / maxSize.height)
  }

  return { maxSize, relativeSizes }
}

// Upload arrays to uniform buffer objects
// Packs different arrays into vec4's to take advantage of GLSL's std140 memory layout

// @ts-ignore
function uploadToUniformBuffer(gl: WebGL2RenderingContext, program: WebGLProgram, bufferData) {
  UniformBuffer.createFromGl(gl, program, 'Materials')
    .set(
      gl,
      'Materials.colorAndMaterialType[0]',
      interleave(
        // @ts-ignore
        { data: [].concat(...bufferData.color.map((d) => d.toArray())), channels: 3 },
        { data: bufferData.type, channels: 1 }
      )
    )
    .set(
      gl,
      'Materials.roughnessMetalnessNormalScale[0]',
      interleave(
        { data: bufferData.roughness, channels: 1 },
        { data: bufferData.metalness, channels: 1 },

        // @ts-ignore
        { data: [].concat(...bufferData.normalScale.map((d) => d.toArray())), channels: 2 }
      )
    )
    .set(
      gl,
      'Materials.diffuseNormalRoughnessMetalnessMapIndex[0]',
      interleave(
        { data: bufferData.diffuseMapIndex, channels: 1 },
        { data: bufferData.normalMapIndex, channels: 1 },
        { data: bufferData.roughnessMapIndex, channels: 1 },
        { data: bufferData.metalnessMapIndex, channels: 1 }
      )
    )
    .set(
      gl,
      'Materials.diffuseNormalMapSize[0]',
      interleave({ data: bufferData.diffuseMapSize, channels: 2 }, { data: bufferData.normalMapSize, channels: 2 })
    )
    .set(gl, 'Materials.pbrMapSize[0]', bufferData.pbrMapSize)
    .bind(gl, 0)
}

// @ts-ignore
function interleave(...arrays) {
  let maxLength = 0
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i]
    const l = a.data ? a.data.length / a.channels : 0
    maxLength = Math.max(maxLength, l)
  }

  const interleaved = []
  for (let i = 0; i < maxLength; i++) {
    for (let j = 0; j < arrays.length; j++) {
      const { data = [], channels } = arrays[j]
      for (let c = 0; c < channels; c++) {
        interleaved.push(data[i * channels + c])
      }
    }
  }

  return interleaved
}

export { makeMaterialBuffer }
