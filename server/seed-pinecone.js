import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pinecone } from '@pinecone-database/pinecone';
import { CohereClient } from 'cohere-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Config ---
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'fitness-programming';
const BATCH_SIZE = 50;

// --- Initialize clients ---
if (!process.env.COHERE_API_KEY || !process.env.PINECONE_API_KEY) {
  console.error('Missing required env vars: COHERE_API_KEY, PINECONE_API_KEY');
  process.exit(1);
}

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(PINECONE_INDEX);

// --- Chunk by markdown headers ---
function chunkByHeaders(text, headerLevel, source) {
  const regex = headerLevel === '##'
    ? /^## (.+)$/gm
    : /^### (.+)$/gm;

  const sections = [];
  const matches = [...text.matchAll(regex)];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const section = matches[i][1].trim();
    const content = text.slice(start, end).trim();

    if (content.length > 50) {
      sections.push({
        text: content,
        section,
        source,
      });
    }
  }

  return sections;
}

async function main() {
  console.log('Reading resource files...');

  // Read Knowledge Base Supplement
  const kbPath = join(__dirname, '../resources/Knowledge Base Supplement');
  const kbText = readFileSync(kbPath, 'utf-8');
  const kbChunks = chunkByHeaders(kbText, '##', 'knowledge-base-supplement');
  console.log(`  Knowledge Base: ${kbChunks.length} chunks`);

  // Read System Prompt
  const spPath = join(__dirname, '../resources/Functional Bodybuilding & CrossFit Programming System Prompt .md');
  const spText = readFileSync(spPath, 'utf-8');
  const spChunks = chunkByHeaders(spText, '###', 'system-prompt');
  console.log(`  System Prompt: ${spChunks.length} chunks`);

  const allChunks = [...kbChunks, ...spChunks];
  console.log(`\nTotal chunks to embed: ${allChunks.length}`);

  // Embed in batches
  const vectors = [];
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)}...`);

    const response = await cohere.embed({
      texts: batch.map((c) => c.text),
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    });

    for (let j = 0; j < batch.length; j++) {
      vectors.push({
        id: `fbb-${i + j}`,
        values: response.embeddings[j],
        metadata: {
          text: batch[j].text,
          section: batch[j].section,
          source: batch[j].source,
        },
      });
    }
  }

  // Upsert in batches
  console.log(`\nUpserting ${vectors.length} vectors to Pinecone...`);
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsert(batch);
    console.log(`  Upserted ${Math.min(i + BATCH_SIZE, vectors.length)}/${vectors.length}`);
  }

  console.log('\nSeeding complete!');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
