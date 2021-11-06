import { PerspectiveCamera } from 'three'

class LensCamera extends PerspectiveCamera {
  aperture: number = 0.01

  constructor(fov?: number, aspect?: number, near?: number, far?: number) {
    super(fov, aspect, near, far)
  }

  copy(source: this, recursive: boolean) {
    super.copy(source, recursive)
    this.aperture = source.aperture
    return this
  }
}

export { LensCamera }
