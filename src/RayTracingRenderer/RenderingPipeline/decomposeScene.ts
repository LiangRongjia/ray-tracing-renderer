// @ts-check
import * as THREE from 'three'

function decomposeScene(scene: THREE.Scene) {
  const meshes: THREE.Object3D[] = []
  const directionalLights: THREE.DirectionalLight[] = []
  const ambientLights: THREE.AmbientLight[] = []
  const environmentLights: THREE.Object3D[] = []

  scene.traverse((child: any) => {
    if (child.isMesh) {
      if (!child.geometry) {
        console.warn(child, 'must have a geometry property')
      } else if (!child.material.isMeshStandardMaterial) {
        console.warn(child, 'must use MeshStandardMaterial in order to be rendered.')
      } else {
        meshes.push(child)
      }
    } else if (child.isDirectionalLight) {
      directionalLights.push(child)
    } else if (child.isAmbientLight) {
      ambientLights.push(child)
    } else if (child.isEnvironmentLight) {
      if (environmentLights.length > 1) {
        console.warn(environmentLights, 'only one environment light can be used per scene')
      }
      // Valid lights have HDR texture map in RGBEEncoding
      if (isHDRTexture(child)) {
        environmentLights.push(child)
      } else {
        console.warn(child, 'environment light does not use color value or map with THREE.RGBEEncoding')
      }
    }
  })

  const background = scene.background

  return {
    background,
    meshes,
    directionalLights,
    ambientLights,
    environmentLights
  }
}

function isHDRTexture(texture: any) {
  return (
    texture.map &&
    texture.map.image &&
    (texture.map.encoding === THREE.RGBEEncoding || texture.map.encoding === THREE.LinearEncoding)
  )
}

export { decomposeScene }