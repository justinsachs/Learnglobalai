/**
 * PgVector Vector Store
 * Production-ready vector store using PostgreSQL with pgvector extension
 */

import type { RetrievedChunk } from '@learnglobal/contracts';
import type { VectorStore } from '../index.js';

export interface PgVectorConfig {
  connectionString: string;
  tableName?: string;
  embeddingDimension?: number;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/**
 * OpenAI Embedding Provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data.map(d => d.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }
}

/**
 * PgVector Vector Store implementation
 */
export class PgVectorStore implements VectorStore {
  private config: Required<PgVectorConfig>;
  private embeddingProvider: EmbeddingProvider;
  private pool: any; // pg.Pool - dynamically imported

  constructor(config: PgVectorConfig, embeddingProvider: EmbeddingProvider) {
    this.config = {
      connectionString: config.connectionString,
      tableName: config.tableName || 'document_embeddings',
      embeddingDimension: config.embeddingDimension || 1536,
    };
    this.embeddingProvider = embeddingProvider;
  }

  async initialize(): Promise<void> {
    // Dynamically import pg to avoid requiring it when using in-memory store
    const { Pool } = await import('pg');
    this.pool = new Pool({ connectionString: this.config.connectionString });

    // Create table and extension if not exists
    await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.config.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB,
        embedding vector(${this.config.embeddingDimension}),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index for similarity search
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${this.config.tableName}_embedding_idx
      ON ${this.config.tableName}
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  async index(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): Promise<number> {
    if (documents.length === 0) return 0;

    // Generate embeddings
    const contents = documents.map(d => d.content);
    const embeddings = await this.embeddingProvider.embed(contents);

    // Insert in batches
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      const values: any[] = [];
      const placeholders: string[] = [];

      batch.forEach((doc, j) => {
        const offset = j * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(
          doc.id,
          doc.content,
          JSON.stringify(doc.metadata || {}),
          `[${batchEmbeddings[j].join(',')}]`
        );
      });

      await this.pool.query(`
        INSERT INTO ${this.config.tableName} (id, content, metadata, embedding)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding
      `, values);

      indexed += batch.length;
    }

    return indexed;
  }

  async search(query: string, limit: number): Promise<RetrievedChunk[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingProvider.embedQuery(query);

    // Perform similarity search
    const result = await this.pool.query(`
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> $1) as score
      FROM ${this.config.tableName}
      ORDER BY embedding <=> $1
      LIMIT $2
    `, [`[${queryEmbedding.join(',')}]`, limit]);

    return result.rows.map((row: any) => ({
      id: row.id,
      sourceId: row.id,
      sourceName: row.metadata?.sourceName || 'Unknown',
      content: row.content.substring(0, 500),
      score: row.score,
      metadata: {
        section: row.metadata?.section,
        type: row.metadata?.type,
      },
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    await this.pool.query(
      `DELETE FROM ${this.config.tableName} WHERE id IN (${placeholders})`,
      ids
    );
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

/**
 * Factory function to create a vector store
 */
export async function createPgVectorStore(
  connectionString: string,
  embeddingApiKey: string,
  options: Partial<PgVectorConfig> = {}
): Promise<PgVectorStore> {
  const embeddingProvider = new OpenAIEmbeddingProvider(embeddingApiKey);
  const store = new PgVectorStore(
    {
      connectionString,
      ...options,
    },
    embeddingProvider
  );
  await store.initialize();
  return store;
}
