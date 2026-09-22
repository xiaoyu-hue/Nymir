/**
 * jsQR 类型声明
 */
declare module 'jsqr' {
  interface QRCodeResult {
    data: string
    binaryData: Uint8Array
    format: string
    findPositions(): void
  }

  function jsQR(
    imageData: Uint8ClampedArray,
    width: number,
    height: number
  ): QRCodeResult | null

  export default jsQR
}
