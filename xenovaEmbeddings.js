import {pipeline} from "@xenova/transformers";

export class XenovaEmbeddings {
    model;
    initialized = false;

    async init() {
        if (!this.initialized) {
            this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            this.initialized = true;
        }
    }

    async embedDocuments(documents) {
        await this.init();
        const embeddings = [];

        for (const doc of documents) {
            const output = await this.model(doc, {pooling: 'mean', normalize: true});
            embeddings.push(Array.from(output.data));
        }

        return embeddings;
    }

    async embedQuery(text) {
        await this.init();
        const output = await this.model(text, {pooling: 'mean', normalize: true});
        return Array.from(output.data);
    }
}