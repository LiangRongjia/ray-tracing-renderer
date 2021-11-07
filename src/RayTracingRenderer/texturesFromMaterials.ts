// retrieve textures used by meshes, grouping textures from meshes shared by *the same* mesh property
function getTexturesFromMaterials(meshes: string[], textureNames: string[]) {
  let textureMap = {}

  for (const name of textureNames) {
    textureMap = {
      ...textureMap,
      [name]: texturesFromMaterials(meshes, name)
    }
  }

  return textureMap as {
    [key: string]: {
      indices: number[]
      textures: any[]
    }
  }
}

// retrieve textures used by meshes, grouping textures from meshes shared *across all* mesh properties
function mergeTexturesFromMaterials(meshes: string[], textureNames: string[]) {
  const temp = textureNames.map((name) => ({
    name,
    ...texturesFromMaterials(meshes, name)
  }))

  const textureMap = {
    textures: temp.map((item) => item.textures).flat(),
    indices: temp.reduce((acc, item) => ({
      ...acc,
      [item.name]: item.indices
    }),{ } as { [key: string]: number[] })
  }

  return textureMap
}

function texturesFromMaterials(materials: any[], textureName: string) {
  const indices = []
  const textures = []

  for (const material of materials) {
    const isTextureLoaded = material[textureName] && material[textureName].image

    if (!isTextureLoaded) {
      indices.push(-1)
    } else {
      let index = textures.length
      for (let i = 0; i < textures.length; i++) {
        if (textures[i] === material[textureName]) {
          // Reuse existing duplicate texture.
          index = i
          break
        }
      }
      if (index === textures.length) {
        // New texture. Add texture to list.
        textures.push(material[textureName])
      }
      indices.push(index)
    }
  }

  return { indices, textures }
}

export { getTexturesFromMaterials, mergeTexturesFromMaterials }
