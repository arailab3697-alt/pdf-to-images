export async function compressPngPayload({
  pngBytes,
  rgbaBytes,
  width,
  height,
  maxColors,
  speed,
  oxipngLevel
}, deps) {
  let bytes = new Uint8Array(pngBytes);

  try {
    const quantizer = await deps.getPngQuantizer();
    const imageData = new ImageData(new Uint8ClampedArray(rgbaBytes), width, height);
    const result = await quantizer.quantizeImageData(imageData, { maxColors, speed });
    bytes = result.pngBytes;
  } catch (error) {
    // Quantize failure is non-fatal.
  }

  try {
    return await deps.optimise(bytes, { level: oxipngLevel });
  } catch (error) {
    return bytes;
  }
}
