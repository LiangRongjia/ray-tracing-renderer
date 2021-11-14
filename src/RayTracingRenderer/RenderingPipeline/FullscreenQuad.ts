// @ts-check
import vertex from './glsl/fullscreenQuad.vert.js'
import { makeVertexShader } from '../RenderPass'

function makeFullscreenQuad(gl: WebGL2RenderingContext) {
  const vao = gl.createVertexArray()

  gl.bindVertexArray(vao)

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW)

  // vertex shader should set layout(location = 0) on position attribute
  const posLoc = 0

  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

  gl.bindVertexArray(null)

  const vertexShader = makeVertexShader(gl, { vertex, defines: undefined })

  function draw() {
    gl.bindVertexArray(vao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  return {
    draw,
    vertexShader
  }
}

export { makeFullscreenQuad }