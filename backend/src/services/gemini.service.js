
let ai;

// Esperar antes de reintentar una petición
function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Detectar errores temporales de Gemini
function esErrorTemporal(error) {
    const detalle = String(error.message || "").toUpperCase();
    const status = error.status || error.statusCode || error.code;

    return (
        Number(status) === 503 ||
        Number(status) === 429 ||
        Number(status) === 500 ||
        detalle.includes("UNAVAILABLE") ||
        detalle.includes("RESOURCE_EXHAUSTED") ||
        detalle.includes("HIGH DEMAND") ||
        detalle.includes("TOO MANY REQUESTS") ||
        detalle.includes('"CODE":503') ||
        detalle.includes('"CODE":429') ||
        detalle.includes('"CODE":500')
    );
}

// Inicializar el cliente de Gemini
async function getAI() {
    // Verificar la clave cuando realmente se necesita Gemini
    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "Falta configurar GEMINI_API_KEY en las variables de entorno."
        );
    }

    if (!ai) {
        const { GoogleGenAI } = await import("@google/genai");

        ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    return ai;
}

// Generar respuesta y recomendaciones
async function generateResponse(message) {
    const client = await getAI();

    const maxIntentos = 4;
    let response = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(
                `Consultando Gemini (intento ${intento}/${maxIntentos})...`
            );

            response = await client.models.generateContent({
                model: "gemini-3.6-flash",
                contents: message,
                config: {
                    responseMimeType: "application/json",
                    systemInstruction: `
                        Sos BookMatch, un recomendador de libros en español.

                        Respondé de forma cálida, natural y breve.

                        Devolvé siempre un JSON válido con esta estructura:
                        {
                          "reply": "Mensaje para el lector",
                          "books": [
                            {
                              "title": "Título real del libro",
                              "author": "Autor real",
                              "genre": "Género",
                              "description": "Descripción breve sin spoilers",
                              "reason": "Por qué podría gustarle al lector"
                            }
                          ]
                        }

                        Reglas:
                        - Si el usuario pide recomendaciones, sugerí entre 3 y 5 libros.
                        - Si pide fantasía, recomendá libros de fantasía.
                        - Usá títulos y autores reales.
                        - No reveles finales ni spoilers importantes.
                        - Si el usuario solo saluda, respondé amablemente
                          y devolvé "books": [].
                        - Si todavía no conocés sus gustos, podés preguntarle
                          qué tipo de historias disfruta y devolver "books": [].
                        - El campo "reply" debe contener una introducción breve.
                        - Devolvé únicamente JSON válido, sin Markdown
                          ni bloques de código.
                    `
                }
            });

            // La petición fue exitosa
            break;

        } catch (error) {
            console.error(
                `Error de Gemini en intento ${intento}:`,
                error.message
            );

            if (!esErrorTemporal(error) || intento === maxIntentos) {
                throw error;
            }

            // Esperas progresivas: 1, 2 y 4 segundos
            const demora = 1000 * (2 ** (intento - 1));

            console.log(
                `Error temporal. Reintentando en ${demora / 1000} segundos...`
            );

            await esperar(demora);
        }
    }

    if (!response || !response.text) {
        throw new Error("Gemini devolvió una respuesta vacía.");
    }

    // Interpretar la respuesta JSON
    try {
        const resultado = JSON.parse(response.text);

        if (
            !resultado ||
            typeof resultado.reply !== "string" ||
            !Array.isArray(resultado.books)
        ) {
            throw new Error(
                "La respuesta no tiene la estructura esperada."
            );
        }

        // Normalizar los libros para evitar datos incompletos
        resultado.books = resultado.books
            .filter((book) => book && typeof book === "object")
            .map((book) => ({
                title: String(book.title || "Título no disponible"),
                author: String(book.author || "Autor no disponible"),
                genre: String(book.genre || "Literatura"),
                description: String(book.description || ""),
                reason: String(book.reason || "")
            }));

        return resultado;

    } catch (error) {
        console.error(
            "Error interpretando el JSON de Gemini:",
            error.message
        );

        throw new Error(
            "Gemini devolvió un formato de respuesta inválido."
        );
    }
}

// Listar los modelos disponibles para la API
async function listModels() {
    const client = await getAI();
    const models = await client.models.list();

    for await (const model of models) {
        console.log({
            nombre: model.name,
            metodos: model.supportedGenerationMethods
        });
    }
}

module.exports = {
    generateResponse,
    listModels
};
