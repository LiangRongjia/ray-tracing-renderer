import resolve from 'rollup-plugin-node-resolve'

const buildEsm = {
  input: 'src/main.js',
  output: {
    file: 'build/RayTracingRenderer.module.js',
    format: 'esm',
    name: 'RayTracingRenderer'
  },
  plugins: [resolve()]
}

const bundle = [buildEsm]

export default bundle