import mongoose from "mongoose";

export let isInMemory = false;

const collections = {
  users: [],
  books: [],
  useractivities: []
};

function clone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
}

function getFieldVal(doc, path) {
  const parts = path.split(".");
  let cur = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function computeTextScore(doc, searchStr) {
  const terms = String(searchStr || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return 0;
  const hay = [
    doc.title || "",
    doc.author || "",
    ...(Array.isArray(doc.genre) ? doc.genre : []),
    ...(Array.isArray(doc.keywords) ? doc.keywords : []),
    doc.description || ""
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += 1;
    if ((doc.title || "").toLowerCase().includes(t)) score += 1.5;
    if ((doc.author || "").toLowerCase().includes(t)) score += 1;
  }
  return score;
}

function matchFilter(doc, filter = {}) {
  for (const [k, v] of Object.entries(filter)) {
    if (k === "$text") {
      const s = v?.$search || "";
      if (computeTextScore(doc, s) <= 0) return false;
      continue;
    }
    const docVal = getFieldVal(doc, k);
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof mongoose.Types.ObjectId)) {
      if ("$in" in v) {
        const targetSet = new Set((v.$in || []).map(String));
        if (Array.isArray(docVal)) {
          if (!docVal.some((x) => targetSet.has(String(x)))) return false;
        } else {
          if (!targetSet.has(String(docVal))) return false;
        }
        continue;
      }
    }
    if (Array.isArray(docVal)) {
      if (!docVal.map(String).includes(String(v))) return false;
    } else {
      if (String(docVal) !== String(v)) return false;
    }
  }
  return true;
}

function wrapDoc(colName, raw) {
  if (!raw) return null;
  const doc = {
    ...raw,
    toObject() {
      const copy = { ...this };
      delete copy.save;
      delete copy.toObject;
      return clone(copy);
    },
    async save() {
      const copy = this.toObject();
      copy.updatedAt = new Date().toISOString();
      const idx = collections[colName].findIndex((x) => String(x._id) === String(copy._id));
      if (idx >= 0) {
        collections[colName][idx] = copy;
      } else {
        collections[colName].push(copy);
      }
      return this;
    }
  };
  return doc;
}

class InMemoryQuery {
  constructor(colName, filter = {}, projection = {}, single = false) {
    this.colName = colName;
    this.filter = filter;
    this.projection = projection;
    this.single = single;
    this._sort = null;
    this._skip = 0;
    this._limit = null;
    this._lean = false;
  }
  sort(s) {
    this._sort = s;
    return this;
  }
  skip(n) {
    this._skip = n;
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  lean() {
    this._lean = true;
    return this;
  }
  _exec() {
    const list = collections[this.colName] || [];
    const textSearch = this.filter?.$text?.$search;
    let results = list
      .filter((d) => matchFilter(d, this.filter))
      .map((d) => {
        const c = clone(d);
        if (textSearch) {
          c.score = computeTextScore(c, textSearch);
        }
        return c;
      });

    if (this._sort) {
      const sortEntries = Object.entries(this._sort);
      results.sort((a, b) => {
        for (const [key, dir] of sortEntries) {
          if (key === "score" || (dir && typeof dir === "object" && dir.$meta === "textScore")) {
            const diff = (b.score || 0) - (a.score || 0);
            if (diff !== 0) return diff;
            continue;
          }
          const va = a[key] ?? 0;
          const vb = b[key] ?? 0;
          if (va < vb) return dir === -1 ? 1 : -1;
          if (va > vb) return dir === -1 ? -1 : 1;
        }
        return 0;
      });
    }

    if (this.single) {
      const item = results[0] || null;
      return this._lean ? item : wrapDoc(this.colName, item);
    }

    if (this._skip) results = results.slice(this._skip);
    if (this._limit != null) results = results.slice(0, this._limit);
    return this._lean ? results : results.map((r) => wrapDoc(this.colName, r));
  }
  then(resolve, reject) {
    return Promise.resolve(this._exec()).then(resolve, reject);
  }
  catch(reject) {
    return Promise.resolve(this._exec()).catch(reject);
  }
}

export function createInMemoryModel(colName, defaults = {}) {
  return {
    find(filter = {}, projection = {}) {
      return new InMemoryQuery(colName, filter, projection, false);
    },
    findOne(filter = {}, projection = {}) {
      return new InMemoryQuery(colName, filter, projection, true);
    },
    findById(id) {
      return new InMemoryQuery(colName, { _id: String(id) }, {}, true);
    },
    async countDocuments(filter = {}) {
      const list = collections[colName] || [];
      return list.filter((d) => matchFilter(d, filter)).length;
    },
    async create(data) {
      const now = new Date().toISOString();
      const doc = {
        ...clone(defaults),
        ...clone(data),
        _id: data._id ? String(data._id) : new mongoose.Types.ObjectId().toString(),
        createdAt: now,
        updatedAt: now
      };
      collections[colName].push(doc);
      return wrapDoc(colName, doc);
    },
    async insertMany(arr) {
      const inserted = [];
      for (const item of arr) {
        const doc = await this.create({
          ratingsAvg: 4.5,
          ratingsCount: 12,
          reviews: [],
          ...item
        });
        inserted.push(doc);
      }
      return inserted;
    },
    async deleteMany(filter = {}) {
      if (!Object.keys(filter).length) {
        collections[colName] = [];
      } else {
        collections[colName] = collections[colName].filter((d) => !matchFilter(d, filter));
      }
    },
    async updateOne(filter, update, options = {}) {
      let idx = collections[colName].findIndex((d) => matchFilter(d, filter));
      if (idx < 0 && options.upsert) {
        const created = await this.create({ ...filter });
        idx = collections[colName].findIndex((d) => String(d._id) === String(created._id));
      }
      if (idx < 0) return { modifiedCount: 0 };
      const target = collections[colName][idx];
      if (update.$set) {
        for (const [k, v] of Object.entries(update.$set)) {
          if (k.includes(".")) {
            const [parent, child] = k.split(".");
            if (!target[parent] || typeof target[parent] !== "object") target[parent] = {};
            target[parent][child] = clone(v);
          } else {
            target[k] = clone(v);
          }
        }
      }
      if (update.$push) {
        for (const [k, v] of Object.entries(update.$push)) {
          if (!Array.isArray(target[k])) target[k] = [];
          if (Array.isArray(v)) {
            target[k].push(...clone(v));
          } else {
            target[k].push(clone(v));
          }
        }
      }
      if (update.$pull) {
        for (const [k, cond] of Object.entries(update.$pull)) {
          if (Array.isArray(target[k])) {
            target[k] = target[k].filter((item) => !matchFilter(item, cond));
          }
        }
      }
      target.updatedAt = new Date().toISOString();
      return { modifiedCount: 1 };
    }
  };
}

export async function connectDb(uri) {
  mongoose.set("bufferCommands", false);
  if (uri) {
    try {
      mongoose.set("strictQuery", true);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log("Connected to MongoDB (remote)");
      return;
    } catch (err) {
      console.warn(`Failed to connect to ${uri}: ${err.message}`);
    }
  }
  isInMemory = true;
  console.log("Using in-memory store (no external MongoDB required)");
}
