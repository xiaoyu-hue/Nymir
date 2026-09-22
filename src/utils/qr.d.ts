declare module 'qrcode' {
  function toString(text: string, options?: { type?: string; width?: number; margin?: number; color?: { dark?: string; light?: string } }): Promise<string>;
  function toDataURL(text: string, options?: { width?: number; margin?: number; color?: { dark?: string; light?: string } }): Promise<string>;
  export default {
    toString,
    toDataURL,
  };
}
