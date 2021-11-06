import resolve from 'rollup-plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

const buildEsm = {
  input: 'src/index.ts',
  output: {
    file: 'build/RayTracingRenderer.module.js',
    format: 'esm',
    name: 'RayTracingRenderer'
  },
  plugins: [
    typescript({ useTsconfigDeclarationDir: true }),
    resolve()
  ]
}

const bundle = [buildEsm]

export default bundle