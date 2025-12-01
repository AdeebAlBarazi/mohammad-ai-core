'use strict';
// Ensures MongoDB indexes for marketplace models are created.
// Guard against double declaration errors when the script is reloaded in certain environments.
let mongoose;
if (globalThis.__mp_mongoose) {
  mongoose = globalThis.__mp_mongoose;
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  mongoose = require('mongoose');
  globalThis.__mp_mongoose = mongoose;
}
const path = require('path');

async function main(){
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/axiom_market';
  console.log('[indexes] connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  // Load models to register indexes
  require('../models/marketplace/Product');
  require('../models/marketplace/Vendor');
  require('../models/marketplace/Warehouse');
  require('../models/marketplace/ProductVariant');
  require('../models/marketplace/ProductMedia');

  // Sync indexes
  const models = mongoose.modelNames();
  for(const name of models){
    const m = mongoose.model(name);
    if(typeof m.syncIndexes === 'function'){
      console.log(`[indexes] syncing ${name} ...`);
      await m.syncIndexes();
    }
  }
  console.log('[indexes] done');
  await mongoose.disconnect();
}

main().catch(err => { console.error('[indexes] error', err); process.exit(1); });
