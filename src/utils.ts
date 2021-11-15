const cloneCase = <T>(classConstructor: new () => T, target: T) => {
  let newCase = new classConstructor()
  // @ts-ignore
  Object.keys(target).forEach((key: keyof T) => (newCase[key] = target[key]))
  return newCase
}

export { cloneCase }
