// @ts-check
import { DirectionalLight } from 'three'

class SoftDirectionalLight extends DirectionalLight {
  constructor(color, intensity, softness = 0) {
    super(color, intensity)
    this.softness = softness
  }

  copy(source) {
    super.copy(source)
    this.softness = source.softness
    return this
  }
}

export { SoftDirectionalLight }
