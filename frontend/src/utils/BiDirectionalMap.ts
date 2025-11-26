/**
 * BiDirectionalMap - A bidirectional map that maintains O(1) lookups in both directions.
 *
 * Provides constant-time access from key→value and value→key by maintaining
 * two internal maps. Ensures the mapping stays synchronized and prevents
 * inconsistencies.
 *
 * @template K - The key type
 * @template V - The value type
 */
export class BiDirectionalMap<K, V> {
  private forward = new Map<K, V>();
  private reverse = new Map<V, K>();

  /**
   * Set a bidirectional mapping between key and value.
   * If the key or value already exists, the old mappings are removed first.
   *
   * @param key - The key
   * @param value - The value
   */
  set(key: K, value: V): void {
    // Remove old mappings if they exist
    const oldValue = this.forward.get(key);
    if (oldValue !== undefined) {
      this.reverse.delete(oldValue);
    }

    const oldKey = this.reverse.get(value);
    if (oldKey !== undefined) {
      this.forward.delete(oldKey);
    }

    // Set new mappings
    this.forward.set(key, value);
    this.reverse.set(value, key);
  }

  /**
   * Get value from key (forward lookup).
   *
   * @param key - The key to look up
   * @returns The associated value, or undefined if not found
   */
  get(key: K): V | undefined {
    return this.forward.get(key);
  }

  /**
   * Get key from value (reverse lookup).
   *
   * @param value - The value to look up
   * @returns The associated key, or undefined if not found
   */
  getReverse(value: V): K | undefined {
    return this.reverse.get(value);
  }

  /**
   * Check if a key exists in the forward map.
   *
   * @param key - The key to check
   * @returns true if the key exists
   */
  has(key: K): boolean {
    return this.forward.has(key);
  }

  /**
   * Check if a value exists in the reverse map.
   *
   * @param value - The value to check
   * @returns true if the value exists
   */
  hasReverse(value: V): boolean {
    return this.reverse.has(value);
  }

  /**
   * Delete a mapping by key.
   *
   * @param key - The key to delete
   * @returns true if the key existed and was deleted
   */
  delete(key: K): boolean {
    const value = this.forward.get(key);
    if (value !== undefined) {
      this.forward.delete(key);
      this.reverse.delete(value);
      return true;
    }
    return false;
  }

  /**
   * Delete a mapping by value.
   *
   * @param value - The value to delete
   * @returns true if the value existed and was deleted
   */
  deleteReverse(value: V): boolean {
    const key = this.reverse.get(value);
    if (key !== undefined) {
      this.reverse.delete(value);
      this.forward.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all mappings.
   */
  clear(): void {
    this.forward.clear();
    this.reverse.clear();
  }

  /**
   * Get the number of mappings.
   */
  get size(): number {
    return this.forward.size;
  }

  /**
   * Iterate over all [key, value] pairs.
   */
  *entries(): IterableIterator<[K, V]> {
    yield* this.forward.entries();
  }

  /**
   * Iterate over all keys.
   */
  *keys(): IterableIterator<K> {
    yield* this.forward.keys();
  }

  /**
   * Iterate over all values.
   */
  *values(): IterableIterator<V> {
    yield* this.forward.values();
  }
}
