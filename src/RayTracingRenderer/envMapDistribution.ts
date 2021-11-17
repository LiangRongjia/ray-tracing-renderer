// Create a piecewise 2D cumulative distribution function of light intensity from an env map
// http://www.pbr-book.org/3ed-2018/Monte_Carlo_Integration/2D_Sampling_with_Multidimensional_Transformations.html#Piecewise-Constant2DDistributions

interface TextureArray {
  width: number
  height: number
  channels: number
  array: Float32Array
}

function makeTextureArray(width: number, height: number, channels: number): TextureArray {
  const array = new Float32Array(channels * width * height)
  return { width, height, channels, array }
}

function set(textureArray: TextureArray, x: number, y: number, channel: number, val: number) {
  const { array, width, channels } = textureArray
  array[channels * (y * width + x) + channel] = val
}

function get(textureArray: TextureArray, x: number, y: number, channel: number) {
  const { array, width, channels } = textureArray
  return array[channels * (y * width + x) + channel]
}

function envMapDistribution(image: { width: any; height: any; data: any }) {
  const data = image.data

  const cdfImage = {
    width: image.width + 2,
    height: image.height + 1
  }

  const cdf = makeTextureArray(cdfImage.width, cdfImage.height, 2)

  for (let y = 0; y < image.height; y++) {
    const sinTheta = Math.sin((Math.PI * (y + 0.5)) / image.height)
    for (let x = 0; x < image.width; x++) {
      const i = 3 * (y * image.width + x)
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      luminance *= sinTheta
      set(cdf, x + 2, y, 0, get(cdf, x + 1, y, 0) + luminance / image.width)
      set(cdf, x + 1, y, 1, luminance)
    }

    const rowIntegral = get(cdf, cdfImage.width - 1, y, 0)

    for (let x = 1; x < cdf.width; x++) {
      set(cdf, x, y, 0, get(cdf, x, y, 0) / rowIntegral)
      set(cdf, x, y, 1, get(cdf, x, y, 1) / rowIntegral)
    }

    set(cdf, 0, y + 1, 0, get(cdf, 0, y, 0) + rowIntegral / image.height)
    set(cdf, 0, y, 1, rowIntegral)
  }

  const integral = get(cdf, 0, cdf.height - 1, 0)

  for (let y = 0; y < cdf.height; y++) {
    set(cdf, 0, y, 0, get(cdf, 0, y, 0) / integral)
    set(cdf, 0, y, 1, get(cdf, 0, y, 1) / integral)
  }

  return {
    ...cdfImage,
    data: cdf.array
  }
}

export { envMapDistribution }
