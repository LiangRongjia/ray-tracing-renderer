import { MeshStandardMaterial, MeshStandardMaterialParameters } from 'three'

class RayTracingMaterial extends MeshStandardMaterial {
  solid: boolean = false
  shadowCatcher: boolean = false
  
  constructor(parameters?: MeshStandardMaterialParameters) {
    super(parameters)
  }

  copy(source: this) {
    super.copy(source)
    this.solid = source.solid
    this.shadowCatcher = source.shadowCatcher
    return this
  }
}

export { RayTracingMaterial }
