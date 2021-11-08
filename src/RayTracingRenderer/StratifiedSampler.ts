/*
Stratified Sampling
http://www.pbr-book.org/3ed-2018/Sampling_and_Reconstruction/Stratified_Sampling.html

Repeatedly sampling random numbers between [0, 1) has the effect of producing numbers that are coincidentally clustered together,
instead of being evenly spaced across the domain.
This produces low quality results for the path tracer since clustered samples send too many rays in similar directions.

We can reduce the amount of clustering of random numbers by using stratified sampling.
Stratification divides the [0, 1) range into partitions, or stratum, of equal size.
Each invocation of the stratified sampler draws one uniform random number from one stratum from a shuffled sequence of stratums.
When every stratum has been sampled once, this sequence is shuffled again and the process repeats.

The returned sample ranges between [0, numberOfStratum).
The integer part ideintifies the stratum (the first stratum being 0).
The fractional part is the random number.

To obtain the stratified sample between [0, 1), divide the returned sample by the stratum count.
*/

import { createIndexArray, shuffle } from './util'

class StratifiedSampler {
  #strata: number[]
  #l: number
  #index: number
  #sample: number[] = []
  #dimensions: number

  strataCount: number

  constructor(strataCount: number, dimensions: number) {
    this.strataCount = strataCount
    this.#dimensions = dimensions
    this.#l = this.strataCount ** this.#dimensions
    this.#strata = createIndexArray(this.#l)
    this.#index = this.#strata.length
  }

  restart() {
    this.#index = 0
  }

  next() {
    if (this.#index >= this.#strata.length) {
      shuffle(this.#strata)
      this.restart()
    }
    let stratum = this.#strata[this.#index++]

    for (let i = 0; i < this.#dimensions; i++) {
      this.#sample[i] = (stratum % this.strataCount) + Math.random()
      stratum = Math.floor(stratum / this.strataCount)
    }

    return this.#sample
  }
}

export { StratifiedSampler }
