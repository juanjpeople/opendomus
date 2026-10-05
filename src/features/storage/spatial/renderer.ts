import { billboard, multiply } from "./matrix";
import type { SpatialCard, XRViewLike } from "./types";

/** Un quad texturado por etiqueta. Recursos GPU limitados y liberados al cerrar la sesión. */
export function createSpatialRenderer(gl: WebGLRenderingContext) {
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Shader allocation failed");
    shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Shader compilation failed");
    return shader;
  };
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const textures = new Map<string, { signature: string; texture: WebGLTexture }>();
  function dispose() {
    for (const entry of textures.values()) gl.deleteTexture(entry.texture);
    textures.clear();
    gl.deleteBuffer(buffer); gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
  }
  try {
    if (!program || !buffer) throw new Error("WebGL allocation failed");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, "attribute vec2 p; varying vec2 uv; uniform mat4 m; void main(){uv=vec2(p.x+0.5,0.5-p.y);gl_Position=m*vec4(p,0.0,1.0);}"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, "precision mediump float; varying vec2 uv; uniform sampler2D image; void main(){vec4 c=texture2D(image,uv);if(c.a<0.01)discard;gl_FragColor=c;}"));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("WebGL link failed");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5,-.5, .5,-.5, -.5,.5, -.5,.5, .5,-.5, .5,.5]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const matrix = gl.getUniformLocation(program, "m");
    gl.uniform1i(gl.getUniformLocation(program, "image"), 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);

    function texture(id: string, signature: string, draw: (context: CanvasRenderingContext2D) => void) {
      const existing = textures.get(id);
      if (existing?.signature === signature) return existing.texture;
      const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 480;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      draw(context);
      const image = existing?.texture ?? gl.createTexture();
      if (!image) throw new Error("Texture allocation failed");
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      textures.set(id, { texture: image, signature });
      return image;
    }
    const reticle = texture("__reticle", "reticle", (context) => {
      context.strokeStyle = "#63e6be"; context.lineWidth = 24;
      context.beginPath(); context.arc(384, 240, 160, 0, 2 * Math.PI); context.stroke();
      context.fillStyle = "#fff"; context.beginPath(); context.arc(384, 240, 25, 0, 2 * Math.PI); context.fill();
    });
    function update(card: SpatialCard) {
      texture(card.id, JSON.stringify(card), (context) => {
        context.fillStyle = "#102338"; context.beginPath(); context.roundRect(0, 0, 768, 480, 28); context.fill();
        context.fillStyle = "#63e6be"; context.fillRect(28, 32, 8, 56);
        const text = (value: string, y: number, size: number, color: string) => {
          context.font = `${size >= 30 ? "600 " : ""}${size}px system-ui, sans-serif`; context.fillStyle = color;
          let label = value;
          while (label.length && context.measureText(label).width > 672) label = label.slice(0, -1);
          if (label !== value) label = `${label.slice(0, -1)}…`;
          context.fillText(label, 48, y);
        };
        text(card.title, 70, 36, "#fff");
        card.lines.slice(0, 6).forEach((line, index) => text(line, 128 + index * 46, 28, "#e8f1f8"));
        text(card.footer, 449, 22, "#8ce9cf");
      });
    }
    function draw(view: XRViewLike, world: ArrayLike<number>, id?: string) {
      const image = id ? textures.get(id)?.texture : reticle;
      if (!image) return;
      const model = billboard(view.transform.matrix, world, id ? .42 : .10, id ? .2625 : .0625, id ? .17 : 0);
      gl.uniformMatrix4fv(matrix, false, multiply(view.projectionMatrix, multiply(view.transform.inverse.matrix, model)));
      gl.bindTexture(gl.TEXTURE_2D, image); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    return { update, draw, dispose, remove(id: string) { const entry = textures.get(id); if (entry) gl.deleteTexture(entry.texture); textures.delete(id); } };
  } catch (error) { dispose(); throw error; }
}
