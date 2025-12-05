import mongoose from 'mongoose';

let currentUri = null;
let switching = false;

export async function connectDB(uri){
  if(!uri){
    throw new Error('MONGO_URI not provided');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  currentUri = uri;
  console.log('[DB] Connected');
}

export async function testConnection(uri){
  const temp = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 4000 });
  await temp.asPromise();
  await temp.close();
  return true;
}

export async function switchDB(uri){
  if(switching) throw new Error('Switch already in progress');
  switching = true;
  try {
    if(!uri) throw new Error('mongoUri required');
    if(uri === currentUri) return { changed:false, reason:'same-uri' };
    console.log('[DB] Switching from', currentUri, 'to', uri);
    await mongoose.connection.close();
    await connectDB(uri);
    switching = false;
    return { changed:true };
  } catch(err){
    switching = false;
    throw err;
  }
}

export function getCurrentUri(){ return currentUri; }
