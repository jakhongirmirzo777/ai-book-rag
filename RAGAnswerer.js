import {GoogleGenerativeAI} from '@google/generative-ai';
import {QdrantClient} from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

class RAGAnswerer {
    constructor() {
        this.qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });

        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }

    async getEmbedding(query) {
        const embeddingModel = this.genAI.getGenerativeModel({model: 'embedding-001'});
        const response = await embeddingModel.embedContent(query);
        return response.embedding.values;
    }

    async retrieveRelevantChunks(queryEmbedding) {
        const searchResult = await this.qdrantClient.search('harry_potter', {
            vector: queryEmbedding,
            limit: 5,
            with_payload: true,
        });

        return searchResult.map(hit => hit.payload.text);
    }

    async generateAnswerWithContext(contextChunks, question) {
        const model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});

        const context = contextChunks.join('\n---\n');

        console.log(context)

        const prompt = `
        You are Hermione Granger from the Harry Potter universe. You're brilliant, precise, and articulate. Answer the question confidently as if you're already familiar with the facts — don't mention reading from any context. Speak as if you're explaining to a stranger. If the answer cannot be found in the information provided, simply respond:
        
        "I don’t have enough information to answer that."
        
        Stay completely in character — confident, intelligent, and with a slightly bookish tone. Do not reference the context or that you are using any external information.
        
        ---
        Context:
        ${context}
        ---
        Question: ${question}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async askQuestion(question) {
        try {
            const queryEmbedding = await this.getEmbedding(question);
            const relevantChunks = await this.retrieveRelevantChunks(queryEmbedding);

            return await this.generateAnswerWithContext(relevantChunks, question);
        } catch (error) {
            console.error(`❌ Error during RAG flow: ${error.message}`);
            return "An error occurred while trying to answer the question.";
        }
    }
}

export default RAGAnswerer;
