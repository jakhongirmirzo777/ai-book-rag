import fs from "fs";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {QdrantClient} from "@qdrant/js-client-rest";
import {QdrantVectorStore} from "@langchain/qdrant";
import {XenovaEmbeddings} from "./xenovaEmbeddings.js";
import {createRequire} from 'module';
import * as dotenv from "dotenv";

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

(async () => {
    // Read and parse PDF
    const buffer = fs.readFileSync("./harry_potter.pdf");
    const parsed = await pdf(buffer);
    const fullText = parsed.text;

    // Split into chunks
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
    });
    const documents = await splitter.createDocuments([fullText]);

    // Connect to Qdrant
    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    // Create collection
    await client.createCollection("harry_potter", {
        vectors: {
            size: 384,
            distance: "Cosine",
        },
    });

    // Embed and store to Qdrant
    await QdrantVectorStore.fromDocuments(
        documents,
        new XenovaEmbeddings(),
        {
            client,
            collectionName: "harry_potter",
        }
    );

    console.log("✅ Successfully embedded and stored in Qdrant");
})();
