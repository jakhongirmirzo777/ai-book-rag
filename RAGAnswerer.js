import {GoogleGenerativeAI} from '@google/generative-ai';
import {QdrantClient} from '@qdrant/js-client-rest';
import {TavilySearch} from "@langchain/tavily";
import dotenv from 'dotenv';

dotenv.config();

class RAGAnswerer {
    constructor() {
        this.qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });

        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

        this.tavily = new TavilySearch({tavilyApiKey: process.env.TAVILY_API_KEY, maxResults: 5});
    }

    async getEmbedding(query) {
        const embeddingModel = this.genAI.getGenerativeModel({model: 'embedding-001'});
        const response = await embeddingModel.embedContent(query);
        return response.embedding.values;
    }

    async searchDB(queryEmbedding) {
        return await this.qdrantClient.search('harry_potter', {
            vector: queryEmbedding,
            limit: 5,
            with_payload: true,
        });
    }

    async searchWeb(query) {
        const response = await this.tavily.invoke({query});
        return response.results?.map(result => result.content)
    }

    async generateAnswerWithDB(contextChunks, question) {
        const context = contextChunks.join('\n---\n');

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


        const model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async generateAnswerWithWeb(question, contextChunks) {
        const context = contextChunks.join('\n---\n');

        const prompt = `
        You are Hermione Granger from the Harry Potter universe. Answer the following question using the information provided from a web search.
        
        Do not mention the web or that you searched. Just answer the question confidently, like Hermione would. If the information is still insufficient, say:
        "I don’t have enough information to answer that."
        
        ---
        Web Context:
        ${context}
        ---
        Question: ${question}
        `;

        const model = this.genAI.getGenerativeModel({model: 'gemini-2.0-flash'});
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async askQuestion(question) {
        try {
            const queryEmbedding = await this.getEmbedding(question);
            const relevantChunks = await this.searchDB(queryEmbedding);

            const isConfident = !!relevantChunks?.find(relevantChunk => relevantChunk.score > 0.75)
            if (isConfident) {
                const context = relevantChunks.map(relevantChunk => relevantChunk.payload.text);

                console.log("Generated with DB")
                return this.generateAnswerWithDB(context, question)
            } else {
                const context = await this.searchWeb(question)

                console.log("Generated with Web")
                return this.generateAnswerWithWeb(question, context)
            }
        } catch (error) {
            console.error(`❌ Error during RAG+Web flow: ${error.message}`);
            return "An error occurred while trying to answer the question.";
        }
    }
}

export default RAGAnswerer;
