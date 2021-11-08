function clamp(x: number, min: number, max: number) {
  return Math.min(Math.max(x, min), max)
}

function shuffle(arr: number[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const x = arr[i]
    arr[i] = arr[j]
    arr[j] = x
  }
  return arr
}

function numberArraysEqual(a: number[], b: number[], eps: number = 1e-4) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > eps) {
      return false
    }
  }

  return true
}

const createIndexArray = (length: number) => {
  const arr = []
  for (let i = 0; i < length; i++) {
    arr.push(i)
  }
  return arr
}

export { clamp, shuffle, numberArraysEqual, createIndexArray }
