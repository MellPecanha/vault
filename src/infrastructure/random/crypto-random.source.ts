import { randomInt } from 'node:crypto';
import { SYMBOLS, type RandomSource, type Symbol } from '../../domain/symbols';

export class CryptoRandomSource implements RandomSource {
  nextSymbol(): Symbol {
    return SYMBOLS[randomInt(SYMBOLS.length)];
  }
}
