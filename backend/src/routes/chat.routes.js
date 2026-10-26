
const express = require("express");

const {
    generateResponse,
    listModels
} = require("../services/gemini.service");

const router = express.Router();

function normalize(text = "") {
    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

async function findBookCover(book) {
    try {
        const title = (book.title || "").trim();
        const author = (book.author || "").trim();

        if (!title) {
            return { ...book, cover: null, previewLink: null };
        }

        const query = `${title} ${author}`;
        const url =
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Open Library respondió ${response.status}`);
        }

        const data = await response.json();
        const results = data.docs || [];

        const wantedTitle = normalize(title);
        const wantedAuthor = normalize(author);

        let match = results.find(item => {
            const foundTitle = normalize(item.title);
            const authors = (item.author_name || []).map(normalize);

            const titleMatches =
                foundTitle === wantedTitle ||
                foundTitle.includes(wantedTitle) ||
                wantedTitle.includes(foundTitle);

            const authorMatches =
                !wantedAuthor ||
                authors.some(name =>
                    name.includes(wantedAuthor) ||
                    wantedAuthor.includes(name)
                );

            return titleMatches && authorMatches && item.cover_i;
        });

        if (!match) {
            match = results.find(item => {
                const foundTitle = normalize(item.title);

                return (
                    item.cover_i &&
                    foundTitle &&
                    (
                        foundTitle.includes(wantedTitle) ||
                        wantedTitle.includes(foundTitle)
                    )
                );
            });
        }

        return {
            ...book,
            cover: match?.cover_i
                ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`
                : null,
            previewLink: match?.key
                ? `https://openlibrary.org${match.key}`
                : null
        };
    } catch (error) {
        console.error(
            `Error buscando portada de "${book.title}":`,
            error.message
        );

        return { ...book, cover: null, previewLink: null };
    }
}

router.post("/", async (req, res) => {
    try {
        const {
            message,
            conversationHistory = [],
            excludedBooks = []
        } = req.body;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "El mensaje no puede estar vacío."
            });
        }

        const history = Array.isArray(conversationHistory)
            ? conversationHistory
                .filter(item =>
                    item &&
                    typeof item.content === "string" &&
                    ["user", "assistant"].includes(item.role)
                )
                .slice(-20)
                .map(item => ({
                    role: item.role,
                    content: item.content.slice(0, 3000)
                }))
            : [];

        const excluded = Array.isArray(excludedBooks)
            ? excludedBooks
                .filter(book => book && typeof book.title === "string")
                .slice(0, 500)
                .map(book => ({
                    title: book.title,
                    author: String(book.author || "")
                }))
            : [];

        const result = await generateResponse(
            message.trim(),
            history,
            excluded
        );

        const excludedTitles = new Set(
            excluded.map(book => normalize(book.title))
        );

        const seenTitles = new Set(excludedTitles);

        const recommendations = (Array.isArray(result.books) ? result.books : [])
            .filter(book => {
                const title = normalize(book.title);

                if (!title || seenTitles.has(title)) {
                    return false;
                }

                seenTitles.add(title);
                return true;
            })
            .slice(0, 5);

        const books = await Promise.all(
            recommendations.map(findBookCover)
        );

        console.log(`BookMatch: ${books.length} libros recomendados.`);
        console.log(
            "Portadas encontradas:",
            books.filter(book => book.cover).length
        );

        return res.json({
            success: true,
            response: result.reply || "Estas son algunas recomendaciones para vos.",
            books
        });
    } catch (error) {
        console.error("Error al consultar Groq:", error.message);

        return res.status(500).json({
            success: false,
            message: "No se pudo obtener una respuesta de la IA."
        });
    }
});

router.get("/models", async (req, res) => {
    try {
        await listModels();

        return res.json({
            success: true,
            message: "Modelos mostrados en la consola."
        });
    } catch (error) {
        console.error("Error al listar modelos:", error.message);

        return res.status(500).json({
            success: false,
            message: "No se pudieron obtener los modelos."
        });
    }
});

module.exports = router;
