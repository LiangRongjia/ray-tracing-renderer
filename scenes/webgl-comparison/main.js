import { Stats } from './lib/stats.module.js'
import * as _THREE from '../../lib/three.module.js'
import * as _RayTracingRenderer from '../../src/main.js'
import { RGBELoader as _RGBELoader } from './lib/RGBELoader.module.js'
import { GLTFLoader as _GLTFLoader } from './lib/GLTFLoader.module.js'
import { OrbitControls as _OrbitControls } from './lib/OrbitControls.module.js'
import { EquirectangularToCubeGenerator as _EquirectangularToCubeGenerator } from './lib/EquirectangularToCubeGenerator.module.js'

const THREE = {
  ..._THREE,
  ..._RayTracingRenderer,
  GLTFLoader: _GLTFLoader,
  RGBELoader: _RGBELoader,
  OrbitControls: _OrbitControls,
  EquirectangularToCubeGenerator: _EquirectangularToCubeGenerator
}

main()

async function getChangeRenderModeTo(store) {
  const [webGlContext, rayTracingContext] = await Promise.all([
    getWebGlContext(store.camera),
    getRayTracingContext(store.camera)
  ])
  const changeRenderModeTo = {
    WebGL: () => { mountContextOnStore(store, webGlContext) },
    RayTracing: () => { mountContextOnStore(store, rayTracingContext) }
  }
  return changeRenderModeTo
}

async function main() {
  const store = {
    camera: createCamera(),
    stats: createStats(),
    renderer: null,
    controls: null,
    scene: null,
    setRenderer: (r) => store.renderer = r,
    setControls: (c) => store.controls = c,
    setScene: (s) => store.scene = s,
  }

  const changeRenderModeTo = await getChangeRenderModeTo(store)

  initGui({ store, changeRenderModeTo })

  const tick = getTickFunc(store)

  tick(performance.now())
}

function getTickFunc(store) {
  const tick = (now = 0) => {
    store.controls.update()

    store.camera.focus = store.controls.target.distanceTo(store.camera.position)

    store.stats.begin()
    store.renderer.sync && store.renderer.sync(now)
    store.renderer.render(store.scene, store.camera)
    store.stats.end()

    requestAnimationFrame(tick)
  }
  return tick
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

function mountContextOnStore(store, context) {
  const { scene, controls, renderer } = context
  store.renderer?.domElement.remove()
  store.setRenderer(renderer)
  store.setControls(controls)
  store.setScene(scene)
  document.body.appendChild(store.renderer.domElement)
  resize(store.renderer, store.camera)
}

function mountStats(store) {
  document.body.appendChild(store.stats.domElement)
}

function unmountLoading() {
  document.querySelector('#loading').remove()
}

function addListeners({ store, changeRenderModeTo }) {
  window.addEventListener('resize', () => resize(store.renderer, store.camera))
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r') {
      changeRenderModeTo.RayTracing()
    } else if (e.key === 'w') {
      changeRenderModeTo.WebGL()
    }
  })
}

function initGui({ store, changeRenderModeTo }) {
  changeRenderModeTo.RayTracing()
  mountStats(store)
  unmountLoading()
  addListeners({ store, changeRenderModeTo })
}

function resize(renderer, camera) {
  if (!renderer.domElement.parentElement) return
  const width = renderer.domElement.parentElement.clientWidth
  const height = renderer.domElement.parentElement.clientHeight
  renderer.setSize(width, height)

  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

async function getWebGlContext(camera) {
  const [envMapLDR, gltf] = await Promise.all([
    load(THREE.TextureLoader, './envmap.jpg'),
    load(THREE.GLTFLoader, './scene.gltf')
  ])

  const model = createModel(gltf)

  const renderer = initRenderer(new THREE.WebGLRenderer({ antialias: true }))
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
  const equiToCube = new THREE.EquirectangularToCubeGenerator(envMapLDR)
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

async function getRayTracingContext(camera) {
  const [envMap, gltf] = await Promise.all([
    load(THREE.RGBELoader, '../envmaps/street-by-water.hdr'),
    load(THREE.GLTFLoader, './scene.gltf'),
  ])

  const model = createModel(gltf)

  const envLight = new THREE.EnvironmentLight(envMap)

  const scene = new THREE.Scene()
  scene.add(model)
  scene.add(envLight)

  const renderer = initRenderer(new THREE.RayTracingRenderer())

  const controls = createControls({ renderer, camera })

  return { scene, renderer, controls }
}

function createControls({ renderer, camera }) {
  const controls = new THREE.OrbitControls(camera, renderer.domElement)
  controls.screenSpacePanning = true
  controls.target.set(0, 20, 0)
  return controls
}

function initRenderer(renderer) {
  renderer.gammaOutput = true
  renderer.gammaFactor = 2.2
  renderer.setPixelRatio(1.0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.5
  renderer.renderWhenOffFocus = false
  renderer.bounces = 3
  return renderer
}

function load(loader, url) {
  return new Promise(resolve => {
    const ldr = new loader()
    ldr.load(url, resolve, undefined, exception => { throw exception })
  })
}
