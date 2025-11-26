import { describe, it, expect, beforeEach } from "vitest";
import { BiDirectionalMap } from "../BiDirectionalMap";

/**
 * Unit tests for BiDirectionalMap.
 *
 * Tests bidirectional mapping functionality, O(1) lookups in both directions,
 * synchronization between forward and reverse maps, and edge cases.
 */

describe("BiDirectionalMap", () => {
  let map: BiDirectionalMap<string, number>;

  beforeEach(() => {
    map = new BiDirectionalMap<string, number>();
  });

  describe("Basic Operations", () => {
    it("should set and get values in both directions", () => {
      map.set("a", 1);

      expect(map.get("a")).toBe(1);
      expect(map.getReverse(1)).toBe("a");
    });

    it("should return undefined for non-existent keys", () => {
      expect(map.get("nonexistent")).toBeUndefined();
      expect(map.getReverse(999)).toBeUndefined();
    });

    it("should check existence in both directions", () => {
      map.set("a", 1);

      expect(map.has("a")).toBe(true);
      expect(map.hasReverse(1)).toBe(true);
      expect(map.has("b")).toBe(false);
      expect(map.hasReverse(2)).toBe(false);
    });

    it("should track size correctly", () => {
      expect(map.size).toBe(0);

      map.set("a", 1);
      expect(map.size).toBe(1);

      map.set("b", 2);
      expect(map.size).toBe(2);

      map.set("c", 3);
      expect(map.size).toBe(3);
    });
  });

  describe("Synchronization", () => {
    it("should keep forward and reverse maps synchronized", () => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);

      // Forward lookups
      expect(map.get("a")).toBe(1);
      expect(map.get("b")).toBe(2);
      expect(map.get("c")).toBe(3);

      // Reverse lookups
      expect(map.getReverse(1)).toBe("a");
      expect(map.getReverse(2)).toBe("b");
      expect(map.getReverse(3)).toBe("c");
    });

    it("should update both maps when overwriting existing key", () => {
      map.set("a", 1);
      expect(map.get("a")).toBe(1);
      expect(map.getReverse(1)).toBe("a");

      // Overwrite with new value
      map.set("a", 2);
      expect(map.get("a")).toBe(2);
      expect(map.getReverse(2)).toBe("a");

      // Old mapping should be gone
      expect(map.getReverse(1)).toBeUndefined();
      expect(map.size).toBe(1); // Still one mapping
    });

    it("should update both maps when overwriting existing value", () => {
      map.set("a", 1);
      expect(map.get("a")).toBe(1);
      expect(map.getReverse(1)).toBe("a");

      // Set different key to same value
      map.set("b", 1);
      expect(map.get("b")).toBe(1);
      expect(map.getReverse(1)).toBe("b");

      // Old mapping should be gone
      expect(map.get("a")).toBeUndefined();
      expect(map.size).toBe(1); // Still one mapping
    });

    it("should handle key-value swap correctly", () => {
      map.set("a", 1);
      map.set("b", 2);

      // Swap values
      map.set("a", 2); // Now a→2 (was a→1, b→2)
      // This should remove b→2 since 2 is now mapped to "a"

      expect(map.get("a")).toBe(2);
      expect(map.getReverse(2)).toBe("a");
      expect(map.get("b")).toBeUndefined(); // b was removed
      expect(map.getReverse(1)).toBeUndefined(); // 1 was removed
      expect(map.size).toBe(1);
    });
  });

  describe("Deletion", () => {
    it("should delete mapping by key", () => {
      map.set("a", 1);
      map.set("b", 2);

      const deleted = map.delete("a");

      expect(deleted).toBe(true);
      expect(map.get("a")).toBeUndefined();
      expect(map.getReverse(1)).toBeUndefined();
      expect(map.size).toBe(1);
      expect(map.get("b")).toBe(2); // Other mapping unaffected
    });

    it("should delete mapping by value", () => {
      map.set("a", 1);
      map.set("b", 2);

      const deleted = map.deleteReverse(1);

      expect(deleted).toBe(true);
      expect(map.get("a")).toBeUndefined();
      expect(map.getReverse(1)).toBeUndefined();
      expect(map.size).toBe(1);
      expect(map.get("b")).toBe(2); // Other mapping unaffected
    });

    it("should return false when deleting non-existent key", () => {
      map.set("a", 1);

      const deleted = map.delete("nonexistent");
      expect(deleted).toBe(false);
      expect(map.size).toBe(1);
    });

    it("should return false when deleting non-existent value", () => {
      map.set("a", 1);

      const deleted = map.deleteReverse(999);
      expect(deleted).toBe(false);
      expect(map.size).toBe(1);
    });

    it("should clear all mappings", () => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);

      map.clear();

      expect(map.size).toBe(0);
      expect(map.get("a")).toBeUndefined();
      expect(map.getReverse(1)).toBeUndefined();
    });
  });

  describe("Iteration", () => {
    beforeEach(() => {
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);
    });

    it("should iterate over entries", () => {
      const entries = Array.from(map.entries());

      expect(entries).toHaveLength(3);
      expect(entries).toContainEqual(["a", 1]);
      expect(entries).toContainEqual(["b", 2]);
      expect(entries).toContainEqual(["c", 3]);
    });

    it("should iterate over keys", () => {
      const keys = Array.from(map.keys());

      expect(keys).toHaveLength(3);
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("c");
    });

    it("should iterate over values", () => {
      const values = Array.from(map.values());

      expect(values).toHaveLength(3);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toContain(3);
    });
  });

  describe("Type Safety", () => {
    it("should work with different key-value types", () => {
      const numToStr = new BiDirectionalMap<number, string>();

      numToStr.set(1, "one");
      numToStr.set(2, "two");

      expect(numToStr.get(1)).toBe("one");
      expect(numToStr.getReverse("two")).toBe(2);
    });

    it("should work with object types", () => {
      type Person = { name: string; id: number };

      const idToObj = new BiDirectionalMap<number, Person>();

      const alice = { name: "Alice", id: 1 };
      const bob = { name: "Bob", id: 2 };

      idToObj.set(1, alice);
      idToObj.set(2, bob);

      expect(idToObj.get(1)).toBe(alice);
      expect(idToObj.getReverse(bob)).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty map operations", () => {
      expect(map.size).toBe(0);
      expect(map.get("any")).toBeUndefined();
      expect(map.getReverse(123)).toBeUndefined();
      expect(map.has("any")).toBe(false);
      expect(map.hasReverse(123)).toBe(false);
      expect(map.delete("any")).toBe(false);
      expect(map.deleteReverse(123)).toBe(false);

      map.clear(); // Should not throw
      expect(map.size).toBe(0);
    });

    it("should handle single mapping", () => {
      map.set("only", 42);

      expect(map.size).toBe(1);
      expect(map.get("only")).toBe(42);
      expect(map.getReverse(42)).toBe("only");

      map.delete("only");
      expect(map.size).toBe(0);
    });

    it("should handle large number of mappings", () => {
      const count = 10000;

      for (let i = 0; i < count; i++) {
        map.set(`key${i}`, i);
      }

      expect(map.size).toBe(count);

      // Spot check some mappings
      expect(map.get("key0")).toBe(0);
      expect(map.get("key5000")).toBe(5000);
      expect(map.get("key9999")).toBe(9999);

      expect(map.getReverse(0)).toBe("key0");
      expect(map.getReverse(5000)).toBe("key5000");
      expect(map.getReverse(9999)).toBe("key9999");
    });

    it("should handle repeated set/delete cycles", () => {
      for (let i = 0; i < 100; i++) {
        map.set("a", i);
        expect(map.get("a")).toBe(i);
        expect(map.getReverse(i)).toBe("a");
        expect(map.size).toBe(1);
      }

      for (let i = 0; i < 100; i++) {
        map.delete("a");
        map.set("a", i);
      }

      expect(map.size).toBe(1);
      expect(map.get("a")).toBe(99);
    });
  });

  describe("Performance Characteristics", () => {
    it("should maintain O(1) lookup performance for forward map", () => {
      const count = 10000;

      // Setup: add many mappings
      for (let i = 0; i < count; i++) {
        map.set(`key${i}`, i);
      }

      // Test: lookups should be fast regardless of map size
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        map.get(`key${Math.floor(Math.random() * count)}`);
      }
      const elapsed = performance.now() - start;

      // 1000 lookups should complete in reasonable time (<50ms)
      expect(elapsed).toBeLessThan(50);
    });

    it("should maintain O(1) lookup performance for reverse map", () => {
      const count = 10000;

      // Setup: add many mappings
      for (let i = 0; i < count; i++) {
        map.set(`key${i}`, i);
      }

      // Test: reverse lookups should be fast regardless of map size
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        map.getReverse(Math.floor(Math.random() * count));
      }
      const elapsed = performance.now() - start;

      // 1000 lookups should complete in reasonable time (<50ms)
      expect(elapsed).toBeLessThan(50);
    });
  });
});
