import Vectorizer from "./Vectorizer.js";
import RAGAnswerer from "./RAGAnswerer.js";

const vectorizer = new Vectorizer()
const ragAnswerer = new RAGAnswerer();

const createCollection = async () => {
    try {
        const pdfText = await vectorizer.extractTextFromPdf("./harry_potter.pdf")
        const chunks = await vectorizer.chunkText(pdfText)
        await vectorizer.uploadToQdrant('harry_potter', chunks)
    } catch (error) {
        console.error("Something went wrong")
    }
}

const askQuestion = async () => {
    // What is the name of Harry Potter’s owl?
    // Where did Harry Potter go to school?
    // Who was the director of Hogwarts?
    // Who is the best friend of Harry?
    // Who is Lily

    const answer = await ragAnswerer.askQuestion("Who is Lily");
    console.log('🔍 Answer:', answer);
};

(async () => {
    // await createCollection()
    await askQuestion()
})()