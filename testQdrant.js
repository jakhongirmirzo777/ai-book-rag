import { QdrantClient } from "@qdrant/js-client-rest";
import * as dotenv from "dotenv";
dotenv.config();

const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});

(async () => {
    try {
        const collections = await client.getCollections();
        console.log("✅ Qdrant is connected. Collections:", collections);
    } catch (error) {
        console.error("❌ Failed to connect to Qdrant:", error);
    }
})();
