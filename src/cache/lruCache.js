// systems/marketplace/src/cache/lruCache.js
// Very small in-memory LRU for product list responses
class LRUCache {
    constructor(limit = 100) {
        this.limit = limit;
        this.map = new Map();
    }
    get(key) {
        if (!this.map.has(key)) return null;
        const val = this.map.get(key);
        // touch
        this.map.delete(key);
        this.map.set(key, val);
        if (val.exp && Date.now() > val.exp) {
            this.map.delete(key);
            return null;
        }
        return val.data;
    }
    set(key, data, ttlMs = 30000) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, { data, exp: Date.now() + ttlMs });
        if (this.map.size > this.limit) {
            // remove oldest
            const first = this.map.keys().next().value;
            this.map.delete(first);
        }
    }
    stats() {
        return { size: this.map.size, limit: this.limit };
    }
    clear() { this.map.clear(); }
}

module.exports = { LRUCache };
