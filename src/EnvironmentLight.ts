import { Light } from 'three'

class EnvironmentLight extends Light {
  map: any
  isEnvironmentLight : boolean = true

  constructor(map: any, hex?: string | number, intensity?: number) {
    super(hex, intensity)
    this.map = map
  }

  copy(source: this) {
    super.copy(source)
    this.map = source.map
    return this
  }
}

export { EnvironmentLight }
