
const express = require("express");
const {
    generateResponse,
    listModels
} = require("../services/gemini.service");

const router = express.Router();

// Normalizar texto para comparar títulos y autores.
function normalize(text = "") {
    return String(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

// Buscar la portada de un libro en Open Library.
async function findBookCover(book) {
    try {
        const title = (book.title || "").trim();
        const author = (book.author || "").trim();

        if (!title) {
            return {
                ...book,
                cover: null,
                previewLink: null
            };
        }

        const query = `${title} ${author}`;

        const url =
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Open Library respondió ${response.status}`
            );
        }

        const data = await response.json();
        const results = data.docs || [];

        const wantedTitle = normalize(title);
        const wantedAuthor = normalize(author);

        // Buscar primero una coincidencia por título y autor.
        let match = results.find((item) => {
            const foundTitle = normalize(item.title);
            const authors = (item.author_name || []).map(normalize);

            const titleMatches =
                foundTitle === wantedTitle ||
                foundTitle.includes(wantedTitle) ||
                wantedTitle.includes(foundTitle);

            const authorMatches =
                !wantedAuthor ||
                authors.some((name) =>
                    name.includes(wantedAuthor) ||
                    wantedAuthor.includes(name)
                );

            return titleMatches && authorMatches && item.cover_i;
        });

        // Si no hay coincidencia exacta, buscar por título.
        if (!match) {
            match = results.find((item) => {
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

        // Si encontramos una portada, construir su URL.
        const cover = match?.cover_i
            ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`
            : null;

        const previewLink = match?.key
            ? `https://openlibrary.org${match.key}`
            : null;

        return {
            ...book,
            cover,
            previewLink
        };
    } catch (error) {
        console.error(
            `Error buscando portada de "${book.title}":`,
            error.message
        );

        return {
            ...book,
            cover: null,
            previewLink: null
        };
    }
}

// Endpoint principal del chat.
router.post("/", async (req, res) => {
    try {
        const { message } = req.body;

        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "El mensaje no puede estar vacío."
            });
        }

        // Obtener respuesta de Gemini.
        const result = await generateResponse(message);

        // Asegurarnos de recibir una lista de libros.
        const recommendations = Array.isArray(result.books)
            ? result.books
            : [];

        // Buscar las portadas.
        const books = await Promise.all(
            recommendations.map(findBookCover)
        );

        // Información para diagnosticar problemas.
        console.log(
            `BookMatch: ${books.length} libros recomendados.`
        );

        console.log(
            "Portadas encontradas:",
            books.filter((book) => book.cover).length
        );

        return res.json({
            success: true,
            response:
                result.reply ||
                "Estas son algunas recomendaciones para vos.",
            books
        });
    } catch (error) {
        console.error(
            "Error al consultar Gemini:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "No se pudo obtener una respuesta de la IA."
        });
    }
});

// Endpoint para consultar los modelos disponibles.
router.get("/models", async (req, res) => {
    try {
        await listModels();

        return res.json({
            success: true,
            message: "Modelos mostrados en la consola."
        });
    } catch (error) {
        console.error(
            "Error al listar modelos:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "No se pudieron obtener los modelos."
        });
    }
});

module.exports = router;
