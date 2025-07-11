import {QdrantClient} from '@qdrant/js-client-rest';
import {pipeline} from '@xenova/transformers';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const llm = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M');

    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const queryText = 'Who was the director of Hogwarts School of Witchcraft and Wizardry?';
    // const queryText = 'Where did Harry Potter go to school?';

    const embeddingResult = await embedder(queryText, {
        pooling: 'mean',
        normalize: true,
    });
    const queryEmbedding = Array.from(embeddingResult.data);
    const searchResult = await client.search('harry_potter', {
        vector: queryEmbedding,
        limit: 3,
        with_payload: true,
    });

    const context = searchResult
        .map((hit) => hit.payload?.content || '')
        .join('\n\n');

    const prompt = `You are a helpful assistant.

    Answer the following question using **only** the context provided below. 
    If the answer is not in the context, say "I don't have enough information to answer that."

    Context:
    ${context}

    Question: ${queryText}

    Answer:`;

    const response = await llm(prompt, {max_new_tokens: 100});
    const answer = response[0]?.generated_text || 'Could not generate an answer.';

    console.log('Answer:', answer);
})();
