// @ts-check
import { MeshStandardMaterial } from 'three'

class RayTracingMaterial extends MeshStandardMaterial {
  constructor(...args) {
    super(...args)
    this.solid = false
    this.shadowCatcher = false
  }

  copy(source) {
    super.copy(source)
    this.solid = source.solid
    this.shadowCatcher = source.shadowCatcher
    return this
  }
}

export { RayTracingMaterial }
