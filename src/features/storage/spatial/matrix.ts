/** Matrices column-major, como WebXR/WebGL. */
export function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
  }
  return result;
}

/** Tarjeta siempre legible, orientada a la cámara, pero con posición fija en el espacio. */
export function billboard(camera: ArrayLike<number>, position: ArrayLike<number>, width: number, height: number, lift = 0): Float32Array {
  const model = new Float32Array(camera);
  for (let row = 0; row < 3; row++) { model[row] *= width; model[4 + row] *= height; }
  model[12] = position[12];
  model[13] = position[13] + lift;
  model[14] = position[14];
  model[15] = 1;
  return model;
}
