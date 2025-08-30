// The entry file of your WebAssembly module.

export function convertNchw(
    data: Uint8ClampedArray,
    floatArray: Float32Array,
    tempCanvasWidth: u16, // 640
    tempCanvasHeight: u16 // 640
): Float32Array {
    const size = tempCanvasWidth * tempCanvasHeight;
    // NCHW (channel-first) で格納: [R(全部), G(全部), B(全部)]
    for (let y: u16 = 0; y < tempCanvasHeight; y++) {
        for (let x: u16 = 0; x < tempCanvasWidth; x++) {
            const pixelIndex: u32 = y * tempCanvasWidth + x;
            const dataIndex: u32 = pixelIndex * 4;
            
            floatArray[pixelIndex] = data[dataIndex] / 255;                // R
            floatArray[size + pixelIndex] = data[dataIndex + 1] / 255;     // G
            floatArray[2 * size + pixelIndex] = data[dataIndex + 2] / 255; // B
        }
    }
    return floatArray;
}