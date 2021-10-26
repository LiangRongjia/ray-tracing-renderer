import { MeshStandardMaterial } from '../lib/three.module.js'

export class RayTracingMaterial extends MeshStandardMaterial {
  constructor(...args) {
    super(...args)
    this.solid = false
    this.shadowCatcher = false
  }

  copy(source) {
    super.copy(source)
    this.solid = source.solid
    this.shadowCatcher = source.shadowCatcher
  }
}
