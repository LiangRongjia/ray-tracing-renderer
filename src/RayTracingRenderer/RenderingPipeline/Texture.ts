import { clamp } from '../util'

// interface TextureProps {
//   width?: number
//   height?: number

//   // A single HTMLImageElement, ImageData, or TypedArray,
//   // Or an array of any of these objects. In this case an Array Texture will be created
//   data?: any

//   // If greater than 1, create an Array Texture of this length
//   length?: number

//   // Number of channels, [1-4]. If left blank, the the function will decide the number of channels automatically from the data
//   channels?: 1 | 2 | 3 | 4

//   // Either 'byte' or 'float'
//   // If left empty, the function will decide the format automatically from the data
//   storage?: any

//   // Reverse the texture across the y-axis.
//   flipY?: boolean

//   // sampling properties
//   gammaCorrection?: boolean
//   wrapS?: number
//   wrapT?: number
//   minFilter?: number
//   magFilter?: number
// }

// class Texture {
//   width: number = 0
//   height: number = 0

//   // A single HTMLImageElement, ImageData, or TypedArray,
//   // Or an array of any of these objects. In this case an Array Texture will be created
//   data: any = null

//   // If greater than 1, create an Array Texture of this length
//   length: number = 1

//   // Number of channels, [1-4]. If left blank, the the function will decide the number of channels automatically from the data
//   channels: any = null

//   // Either 'byte' or 'float'
//   // If left empty, the function will decide the format automatically from the data
//   storage: any = null

//   // Reverse the texture across the y-axis.
//   flipY: boolean = false

//   // sampling properties
//   gammaCorrection: boolean = false
//   wrapS: number = 0
//   wrapT: number = 0
//   minFilter: number = 0
//   magFilter: number = 0

//   texture: WebGLTexture | null

//   target
//   dataArray

//   constructor(gl: WebGL2RenderingContext, params: TextureProps) {
//     params.width !== undefined && (this.width = params.width)
//     params.height !== undefined && (this.height = params.height)
//     params.data !== undefined && (this.data = params.data)
//     params.length !== undefined && (this.length = params.length)
//     params.channels !== undefined && (this.channels = params.channels)
//     params.storage !== undefined && (this.storage = params.storage)
//     params.flipY !== undefined && (this.flipY = params.flipY)
//     params.gammaCorrection !== undefined && (this.gammaCorrection = params.gammaCorrection)
//     this.wrapS = params.wrapS !== undefined ? params.wrapS : gl.CLAMP_TO_EDGE
//     this.wrapT = params.wrapT !== undefined ? params.wrapT : gl.CLAMP_TO_EDGE
//     this.minFilter = params.minFilter !== undefined ? params.minFilter : gl.NEAREST
//     this.magFilter = params.magFilter !== undefined ? params.magFilter : gl.NEAREST
//     this.texture = gl.createTexture()

//     // if data is a JS array but not a TypedArray, assume data is an array of images and create a GL Array Texture
//     if (Array.isArray(this.data)) {
//       this.dataArray = this.data
//       this.data = this.dataArray[0]
//     }

//     this.target = this.dataArray || length > 1 ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D

//     gl.activeTexture(gl.TEXTURE0)
//     gl.bindTexture(this.target, this.texture)

//     gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, this.wrapS)
//     gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapT)
//     gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minFilter)
//     gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magFilter)
//   }
// }

// @ts-ignore
function makeTexture(gl: WebGL2RenderingContext, params: any) {
  let {
    width = null,
    height = null,

    // A single HTMLImageElement, ImageData, or TypedArray,
    // Or an array of any of these objects. In this case an Array Texture will be created
    data = null,

    // If greater than 1, create an Array Texture of this length
    length = 1,

    // Number of channels, [1-4]. If left blank, the the function will decide the number of channels automatically from the data
    channels = null,

    // Either 'byte' or 'float'
    // If left empty, the function will decide the format automatically from the data
    storage = null,

    // Reverse the texture across the y-axis.
    flipY = false,

    // sampling properties
    gammaCorrection = false,
    wrapS = gl.CLAMP_TO_EDGE,
    wrapT = gl.CLAMP_TO_EDGE,
    minFilter = gl.NEAREST,
    magFilter = gl.NEAREST
  } = params

  width = width || data.width || 0
  height = height || data.height || 0

  const texture = gl.createTexture()

  if (texture === null) {
    throw new Error('gl.createTexture() === null')
  }

  let target
  let dataArray

  // if data is a JS array but not a TypedArray, assume data is an array of images and create a GL Array Texture
  if (Array.isArray(data)) {
    dataArray = data
    data = dataArray[0]
  }

  target = dataArray || length > 1 ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(target, texture)

  gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapS)
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapT)
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minFilter)
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magFilter)

  if (!channels) {
    if (data && data.length) {
      channels = data.length / (width * height) // infer number of channels from data size
    } else {
      channels = 4
    }
  }

  channels = clamp(channels, 1, 4)

  const { type, format, internalFormat } = getTextureFormat(gl, channels, storage, data, gammaCorrection)

  if (dataArray) {
    gl.texStorage3D(target, 1, internalFormat, width, height, dataArray.length)
    for (let i = 0; i < dataArray.length; i++) {
      // if layer is an HTMLImageElement, use the .width and .height properties of each layer
      // otherwise use the max size of the array texture
      const layerWidth = dataArray[i].width || width
      const layerHeight = dataArray[i].height || height

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Array.isArray(flipY) ? flipY[i] : flipY)

      gl.texSubImage3D(target, 0, 0, 0, i, layerWidth, layerHeight, 1, format, type, dataArray[i])
    }
  } else if (length > 1) {
    // create empty array texture
    gl.texStorage3D(target, 1, internalFormat, width, height, length)
  } else {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY)
    gl.texStorage2D(target, 1, internalFormat, width, height)
    if (data) {
      gl.texSubImage2D(target, 0, 0, 0, width, height, format, type, data)
    }
  }

  // return state to default
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)

  return {
    target,
    texture
  }
}

function makeDepthTarget(gl: WebGL2RenderingContext, width: number, height: number) {
  const texture = gl.createRenderbuffer()
  const target = gl.RENDERBUFFER

  if (texture === null) {
    throw new Error('gl.createRenderbuffer() === null')
  }

  gl.bindRenderbuffer(target, texture)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height)
  gl.bindRenderbuffer(target, null)

  return {
    target,
    texture
  }
}

function getFormat(gl: WebGL2RenderingContext, channels: 1 | 2 | 3 | 4): number {
  const map = {
    1: gl.RED,
    2: gl.RG,
    3: gl.RGB,
    4: gl.RGBA
  }
  return map[channels]
}

function getTextureFormat(
  gl: WebGL2RenderingContext,
  channels: 1 | 2 | 3 | 4,
  storage: 'byte' | 'float' | 'halfFloat' | 'snorm',
  // @ts-ignore
  data,
  gammaCorrection: boolean
) {
  let type: number = NaN
  let internalFormat: number = NaN

  const isByteArray =
    data instanceof Uint8Array ||
    data instanceof HTMLImageElement ||
    data instanceof HTMLCanvasElement ||
    data instanceof ImageData

  const isFloatArray = data instanceof Float32Array

  if (storage === 'byte' || (!storage && isByteArray)) {
    internalFormat = {
      1: gl.R8,
      2: gl.RG8,
      3: gammaCorrection ? gl.SRGB8 : gl.RGB8,
      4: gammaCorrection ? gl.SRGB8_ALPHA8 : gl.RGBA8
    }[channels]

    type = gl.UNSIGNED_BYTE
  } else if (storage === 'float' || (!storage && isFloatArray)) {
    internalFormat = {
      1: gl.R32F,
      2: gl.RG32F,
      3: gl.RGB32F,
      4: gl.RGBA32F
    }[channels]

    type = gl.FLOAT
  } else if (storage === 'halfFloat') {
    internalFormat = {
      1: gl.R16F,
      2: gl.RG16F,
      3: gl.RGB16F,
      4: gl.RGBA16F
    }[channels]

    type = gl.FLOAT
  } else if (storage === 'snorm') {
    internalFormat = {
      1: gl.R8_SNORM,
      2: gl.RG8_SNORM,
      3: gl.RGB8_SNORM,
      4: gl.RGBA8_SNORM
    }[channels]

    type = gl.UNSIGNED_BYTE
  }

  return {
    format: getFormat(gl, channels),
    internalFormat,
    type
  }
}

export { makeTexture, makeDepthTarget }
