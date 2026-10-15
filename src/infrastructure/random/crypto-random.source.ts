import { randomInt } from 'node:crypto';
import { SYMBOL_WEIGHTS, TOTAL_SYMBOL_WEIGHT, type RandomSource, type Symbol } from '../../domain/symbols';

export function symbolForWeightTicket(ticket: number): Symbol {
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= TOTAL_SYMBOL_WEIGHT) {
    throw new RangeError(`Weight ticket must be an integer between 0 and ${TOTAL_SYMBOL_WEIGHT - 1}.`);
  }

  let upperBound = 0;
  for (const [symbol, weight] of SYMBOL_WEIGHTS) {
    upperBound += weight;
    if (ticket < upperBound) return symbol;
  }

  throw new Error('Symbol weights must cover every weight ticket.');
}

export class CryptoRandomSource implements RandomSource {
  nextSymbol(): Symbol {
    return symbolForWeightTicket(randomInt(TOTAL_SYMBOL_WEIGHT));
  }
}
