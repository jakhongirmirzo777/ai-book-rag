import fs from 'fs';
import {createRequire} from 'module';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {QdrantClient} from '@qdrant/js-client-rest';
import {v4 as uuidv4} from 'uuid';
import pLimit from 'p-limit';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

class Vectorizer {
    async extractTextFromPdf(pdfPath) {
        try {
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdf(dataBuffer);

            console.log(`✅ Extracted text from ${pdfPath}. Total pages: ${data.numpages}.`);
            return data.text;
        } catch (error) {
            console.error(`❌ Error extracting text from PDF: ${error.message}`);
            throw error;
        }
    }

    async chunkText(fullText) {
        try {
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            const finalChunks = await splitter.createDocuments([fullText]);

            console.log(`✅ Chunked text into ${finalChunks.length} pieces.`);
            return finalChunks.map((chunk) => chunk.pageContent);
        } catch (error) {
            console.error(`❌ Error creating chunks: ${error.message}`);
            throw error;
        }
    }

    async getEmbedding(textContent) {
        try {
            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
            const embeddingModel = genAI.getGenerativeModel({model: 'embedding-001'});
            const result = await embeddingModel.embedContent(textContent);
            return result.embedding;
        } catch (error) {
            console.error(`❌ Error generating embedding: ${error.message}`);
            throw error;
        }
    }

    async uploadToQdrant(collectionName, chunks) {
        try {
            const client = new QdrantClient({
                url: process.env.QDRANT_URL,
                apiKey: process.env.QDRANT_API_KEY,
            });

            // Get or create collection
            const collections = await client.getCollections();
            const exists = collections.collections.find((c) => c.name === collectionName);

            // Get vector size from first embedding
            const firstEmbedding = await this.getEmbedding(chunks[0]);

            if (!exists) {
                await client.createCollection(collectionName, {
                    vectors: {
                        size: firstEmbedding.values.length,
                        distance: 'Cosine',
                    },
                });
                console.log(`✅ Created collection: ${collectionName}`);
            } else {
                console.log(`ℹ️ Collection "${collectionName}" already exists.`);
            }

            const limit = pLimit(50);
            const embedChunk = chunk => limit(async () => {
                const embedding = await this.getEmbedding(chunk);
                return {
                    id: uuidv4(),
                    vector: embedding.values,
                    payload: {
                        text: chunk
                    },
                };
            });

            const points = await Promise.all(chunks.map(embedChunk));
            console.log(`✅ Embedded ${points.length} chunks with concurrency limit.`);

            await client.upsert(collectionName, {points});
            console.log(`✅ Uploaded ${points.length} vectors to Qdrant.`);
        } catch (error) {
            console.error(`❌ Error uploading to Qdrant: ${error.message}`);
            throw error;
        }
    }
}

export default Vectorizer