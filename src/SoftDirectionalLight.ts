import { Color, DirectionalLight } from 'three'

class SoftDirectionalLight extends DirectionalLight {
  softness: number

  constructor(color?: string | number | Color, intensity?: number, softness: number = 0) {
    super(color, intensity)
    this.softness = softness
  }

  copy(source: this) {
    super.copy(source)
    this.softness = source.softness
    return this
  }
}

export { SoftDirectionalLight }
