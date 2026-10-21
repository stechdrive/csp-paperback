/** Display-only WebGL2 atlas. Compositing and export keep the original Canvas renderer. */
export interface BoardSprite { key: string; image?: HTMLCanvasElement; x: number; y: number; width: number; height: number }
interface Slot { page: Page; index: number; image: HTMLCanvasElement; u: number; v: number; w: number; h: number; used: number }
interface Page { texture: WebGLTexture; edge: number; cell: number; free: number[]; slots: Set<string> }
const budget = 32 * 1024 * 1024

export class OutputBoardRenderer {
  readonly backend: 'webgl2' | 'canvas2d'
  private gl: WebGL2RenderingContext | null
  private ctx: CanvasRenderingContext2D | null = null
  private program?: WebGLProgram
  private viewport?: WebGLUniformLocation | null
  private buffer?: WebGLBuffer
  private pages: Page[] = []
  private slots = new Map<string, Slot>()
  private frame = 0
  private bytes = 0
  private lost = false
  readonly fallback: BoardSprite[] = []
  private canvas: HTMLCanvasElement
  private invalidate: () => void
  constructor(canvas: HTMLCanvasElement, invalidate: () => void) {
    this.canvas = canvas; this.invalidate = invalidate
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
    this.backend = this.gl ? 'webgl2' : 'canvas2d'
    if (this.gl) { try { this.initialize() } catch { this.lost = true } }
    else this.ctx = canvas.getContext('2d')
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
  }
  private onLost = (event: Event) => { event.preventDefault(); this.lost = true; this.slots.clear(); this.pages = []; this.bytes = 0; this.invalidate() }
  private onRestored = () => { try { this.initialize(); this.lost = false } catch { this.lost = true } this.invalidate() }
  get available() { return !this.lost }
  get textureBytes() { return this.bytes }
  private initialize() {
    const gl = this.gl!
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Board shader')
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, '#version 300 es\nin vec2 position; in vec2 uv; uniform vec2 viewport; out vec2 texCoord; void main(){gl_Position=vec4(position/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);texCoord=uv;}')
    const fragment = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; uniform sampler2D atlas; in vec2 texCoord; out vec4 color; void main(){color=texture(atlas,texCoord);}')
    this.program = gl.createProgram()!; gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program)
    gl.deleteShader(vertex); gl.deleteShader(fragment)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Board shader link')
    this.viewport = gl.getUniformLocation(this.program, 'viewport')
    this.buffer = gl.createBuffer()!
    gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    for (const [name, offset] of [['position', 0], ['uv', 8]] as const) {
      const location = gl.getAttribLocation(this.program, name)
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset)
    }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }
  private remove(key: string) {
    const slot = this.slots.get(key)
    if (!slot) return
    slot.page.free.push(slot.index); slot.page.slots.delete(key); this.slots.delete(key)
  }
  private upload(key: string, image: HTMLCanvasElement): Slot | undefined {
    const gl = this.gl!, cell = 2 ** Math.ceil(Math.log2(Math.max(image.width, image.height)))
    // Requests stay below WebGL2's guaranteed texture-size limit.
    if (cell > 2048) return undefined
    const old = this.slots.get(key)
    if (old?.image === image) { old.used = this.frame; return old }
    // Free obsolete large cells before allocating their smaller replacements.
    // This also permits zooming out when old detail pages filled the budget.
    if (old) this.remove(key)
    let page = this.pages.find(page => page.cell === cell && page.free.length)
    if (!page) {
      for (const [candidate, slot] of this.slots) if (slot.used < this.frame - 1 && slot.page.cell === cell) {
        this.remove(candidate); page = slot.page; break
      }
    }
    if (!page) {
      const edge = Math.max(512, cell), bytes = edge * edge * 4
      for (const candidate of [...this.pages]) {
        if (this.bytes + bytes <= budget) break
        if ([...candidate.slots].some(key => this.slots.get(key)!.used >= this.frame - 1)) continue
        for (const key of [...candidate.slots]) this.remove(key)
        gl.deleteTexture(candidate.texture); this.pages.splice(this.pages.indexOf(candidate), 1); this.bytes -= candidate.edge ** 2 * 4
      }
      if (this.bytes + bytes > budget) return undefined
      const texture = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, edge, edge)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      page = { texture, cell, edge, slots: new Set(), free: Array.from({ length: (edge / cell) ** 2 }, (_, i) => i).reverse() }
      this.pages.push(page); this.bytes += bytes
    }
    const index = page.free.pop()!, columns = page.edge / cell, x = index % columns * cell, y = Math.floor(index / columns) * cell
    gl.bindTexture(gl.TEXTURE_2D, page.texture); gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, image)
    const slot = { page, index, image, u: (x + .5) / page.edge, v: (y + .5) / page.edge,
      w: Math.max(0, image.width - 1) / page.edge, h: Math.max(0, image.height - 1) / page.edge, used: this.frame }
    this.slots.set(key, slot); page.slots.add(key)
    return slot
  }
  draw(sprites: BoardSprite[], width: number, height: number, ratio: number) {
    this.frame++
    this.fallback.length = 0
    if (this.lost) return false
    const canvas = this.canvas, w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio))
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    if (this.ctx) {
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0); this.ctx.clearRect(0, 0, width, height)
      for (const sprite of sprites) if (sprite.image) this.ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.width, sprite.height)
      return true
    }
    const gl = this.gl!, batches = new Map<Page, number[]>(), started = performance.now()
    let pending = false
    for (const sprite of sprites) { const slot = this.slots.get(sprite.key); if (slot) slot.used = this.frame }
    for (const sprite of sprites) {
      if (!sprite.image) continue
      let slot = this.slots.get(sprite.key)
      if (slot?.image !== sprite.image) {
        if (performance.now() - started < 4) slot = this.upload(sprite.key, sprite.image) ?? this.slots.get(sprite.key)
        else pending = true
      }
      // Keep every image visible even while transfers are deferred or the atlas is full.
      if (!slot) { this.fallback.push(sprite); continue }
      const { x, y, width: sw, height: sh } = sprite, { u, v, w: uw, h: vh, page } = slot
      const vertices = batches.get(page) ?? []
      vertices.push(x,y,u,v, x+sw,y,u+uw,v, x,y+sh,u,v+vh, x,y+sh,u,v+vh, x+sw,y,u+uw,v, x+sw,y+sh,u+uw,v+vh)
      batches.set(page, vertices)
    }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program!); gl.uniform2f(this.viewport!, width, height)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer!)
    for (const [page, vertices] of batches) {
      gl.bindTexture(gl.TEXTURE_2D, page.texture); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4)
    }
    if (pending) this.invalidate()
    return !pending
  }
  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    if (this.gl && !this.lost) {
      for (const page of this.pages) this.gl.deleteTexture(page.texture)
      if (this.buffer) this.gl.deleteBuffer(this.buffer)
      if (this.program) this.gl.deleteProgram(this.program)
    }
    this.slots.clear(); this.pages = []; this.bytes = 0; this.canvas.width = this.canvas.height = 1
  }
}
