import * as _THREE from '../../lib/three.module.js'
import { GLTFLoader } from './lib/GLTFLoader.module.js'
import { OrbitControls } from './lib/OrbitControls.module.js'
import { Stats } from './lib/stats.module.js'
import { RGBELoader } from './lib/RGBELoader.module.js'
import * as RayTracingRenderer from '../../src/main.js'
import { EquirectangularToCubeGenerator } from './lib/EquirectangularToCubeGenerator.module.js'

const THREE = {
  ..._THREE,
  GLTFLoader,
  OrbitControls,
  RGBELoader,
  EquirectangularToCubeGenerator,
  ...RayTracingRenderer
}

init()

async function init() {
  const camera = createCamera()
  const stats = createStats()
  const state = {
    renderer: null,
    controls: null,
    scene: null,
    setRenderer: (r) => state.renderer = r,
    setControls: (c) => state.controls = c,
    setScene: (s) => state.scene = s,
  }

  await initGui({ state, camera })
  mountStats(stats)
  addListeners({ state, camera })

  const tick = getTickFunc({ state, camera, stats })

  tick(performance.now())
}

function getTickFunc({ state, camera, stats }) {
  const tick = (now = 0) => {
    state.controls.update()

    camera.focus = state.controls.target.distanceTo(camera.position)

    stats.begin()
    if (state.renderer.sync) state.renderer.sync(now)
    state.renderer.render(state.scene, camera)
    stats.end()

    requestAnimationFrame(tick)
  }
  return tick
}

function mountStats(stats) {
  document.body.appendChild(stats.domElement)
  document.querySelector('#loading').remove()
}

function addListeners({ state, camera }) {
  window.addEventListener('resize', () => resize(state.renderer, camera))
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(64, 32, 16)
  camera.fov = 65
  return camera
}

function createStats() {
  const stats = Stats()
  stats.setMode(0) // 0: fps, 1: ms
  stats.domElement.style.position = 'absolute'
  stats.domElement.style.left = '0px'
  stats.domElement.style.top = '0px'
  return stats
}

function createModel(gltf) {
  const model = gltf.scene
  model.scale.set(0.5, 0.5, 0.5)
  model.rotateY(Math.PI / 2)
  model.traverse(child => {
    if (child instanceof THREE.Mesh) {
      // only necessary for WebGLRenderer
      child.castShadow = true
      child.receiveShadow = true
    }
    if (child.material && child.material.name == 'LensesMat') {
      child.material.transparent = true
    }
  })
  return model
}

async function initGui({ state, camera }) {
  const [envMap, envMapLDR, gltf] = await Promise.all([
    load(RGBELoader, '../envmaps/street-by-water.hdr'),
    load(THREE.TextureLoader, './envmap.jpg'),
    load(GLTFLoader, './scene.gltf'),
  ])

  const model = createModel(gltf)

  const toRenderMode = {
    WebGL: () => {
      unloadRenderer(state.renderer, state.controls)
      const { scene, renderer, controls } = initWebGL({ envMapLDR, model, camera })
      state.setRenderer(renderer)
      state.setControls(controls)
      state.setScene(scene)
      resize(renderer, camera)
    },
    RayTracing: () => {
      unloadRenderer(state.renderer, state.controls)
      const { scene, renderer, controls } = initRayTracing({ envMap, model, camera })
      state.setRenderer(renderer)
      state.setControls(controls)
      state.setScene(scene)
      resize(renderer, camera)
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r') toRenderMode.RayTracing()
    else if (e.key === 'w') toRenderMode.WebGL()
  })

  toRenderMode.RayTracing()
}

function resize(renderer, camera) {
  if (!renderer.domElement.parentElement) return
  const width = renderer.domElement.parentElement.clientWidth
  const height = renderer.domElement.parentElement.clientHeight
  renderer.setSize(width, height)

  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function initWebGL({ envMapLDR, model, camera }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  initRenderer(renderer)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const dirLight = new THREE.DirectionalLight(0xff3300, 0.3)
  dirLight.target.position.set(0, 20, 0)
  dirLight.castShadow = true
  dirLight.position.setFromSphericalCoords(100, -1.31, 4.08)
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  dirLight.shadow.camera.left = -50
  dirLight.shadow.camera.right = 50
  dirLight.shadow.camera.top = 50
  dirLight.shadow.camera.bottom = -50

  const ambLight = new THREE.AmbientLight(0xffffff, 0.2)
  const equiToCube = new EquirectangularToCubeGenerator(envMapLDR)
  const cubeMap = equiToCube.renderTarget
  const cubeMapTexture = equiToCube.update(renderer)

  const scene = new THREE.Scene()
  scene.background = cubeMap
  scene.add(model)
  scene.add(dirLight.target)
  scene.add(dirLight)
  scene.add(ambLight)
  scene.traverse(child => {
    if (child.material) child.material.envMap = cubeMapTexture
  })

  const controls = createControls({ renderer, camera })

  return { scene, renderer, controls }
}

function initRayTracing({ envMap, model, camera }) {
  const envLight = new RayTracingRenderer.EnvironmentLight(envMap)

  const scene = new THREE.Scene()
  scene.add(model)
  scene.add(envLight)

  const renderer = new RayTracingRenderer.RayTracingRenderer()
  initRenderer(renderer)

  const controls = createControls({ renderer, camera })

  return { scene, renderer, controls }
}

function createControls({ renderer, camera }) {
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.screenSpacePanning = true
  controls.target.set(0, 20, 0)
  return controls
}

function initRenderer(renderer) {
  document.body.appendChild(renderer.domElement)

  renderer.gammaOutput = true
  renderer.gammaFactor = 2.2
  renderer.setPixelRatio(1.0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.5
  renderer.renderWhenOffFocus = false
  renderer.bounces = 3
}

function unloadRenderer(renderer, controls) {
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  if (controls) {
    controls.dispose()
  }
}

function load(loader, url) {
  return new Promise(resolve => {
    const ldr = new loader()
    ldr.load(url, resolve, undefined, exception => { throw exception })
  })
}
