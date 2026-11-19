import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env before seeding the catalog.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const products = JSON.parse(await readFile(path.join(root, 'data/products.json'), 'utf8'));
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const collection = client.db(process.env.MONGODB_DATABASE || 'maison_form').collection('products');
  await collection.createIndex({ id: 1 }, { unique: true });
  for (const product of products) await collection.updateOne({ id: product.id }, { $set: { ...product, active: true, updatedAt: new Date() } }, { upsert: true });
  console.log(`Seeded ${products.length} demonstration catalog products.`);
} finally {
  await client.close();
}
