const isDev = import.meta.env.DEV

export const log = isDev ? console.log : () => {}
export const warn = isDev ? console.warn : () => {}
export const error = (...args: unknown[]) => console.error(...args)
