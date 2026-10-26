
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
async function generateResponse(message, conversationHistory = []) {
    const client = await getAI();

    const history = Array.isArray(conversationHistory)
        ? conversationHistory
        : [];

    const historialTexto = history
        .filter(item => item && typeof item.text === "string")
        .map(item => {
            const role =
                item.sender === "user" ? "Usuario" : "BookMatch";

            return `${role}: ${item.text}`;
        })
        .slice(-12)
        .join("\n");

    const maxIntentos = 4;
    let response = null;

    for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
            console.log(
                `Consultando Gemini (intento ${intento}/${maxIntentos})...`
            );

            response = await client.models.generateContent({
                model: "gemini-3.6-flash",
                contents: `
Historial de la conversación:
${historialTexto || "(Esta es la primera interacción)"}

Mensaje actual del usuario:
${message}

Respondé al mensaje actual teniendo en cuenta el historial.
                `.trim(),
                config: {
                    responseMimeType: "application/json",
                    systemInstruction: `
Sos BookMatch, un recomendador de libros en español rioplatense.

PERSONALIDAD Y TONO:
- Sos cálido, natural, cercano y amable.
- Hablá como en una conversación continua, no como si cada mensaje fuera el primero.
- Evitá introducciones largas y expresiones exageradas.
- No repitas información que ya diste, salvo que el usuario la solicite.

SALUDOS:
- Saludá solamente cuando sea el inicio real de una conversación nueva
  y todavía no haya ocurrido un saludo.
- Si BookMatch ya saludó en el historial, NO vuelvas a saludar.
- No empieces cada respuesta con "¡Hola!", "¡Hola de nuevo!",
  "¡Qué bueno verte!" ni expresiones equivalentes.
- Si el usuario cambia de tema, respondé directamente al nuevo tema.
- Si el usuario ya empezó pidiendo libros, atendé su pedido sin agregar
  un saludo innecesario.
- Un nuevo mensaje no significa que haya comenzado una conversación nueva.

RECOMENDACIONES:
- Si el usuario pide recomendaciones, sugerí entre 3 y 5 libros.
- Adaptá los títulos a lo que pide: autor, género, saga, temática o preferencias.
- Usá títulos y autores reales.
- No inventes datos bibliográficos ni presentes datos dudosos como hechos.
- No reveles finales ni spoilers importantes.
- Explicá brevemente de qué trata cada libro y por qué podría gustarle.
- Si el usuario cambia de género o temática, seguí su nueva solicitud.
- Si pide información que no requiere recomendaciones, respondé directamente
  y devolvé "books": [].

PRIMER CONTACTO:
- Si el usuario solamente saluda, respondé amablemente y devolvé "books": [].
- Si todavía no conocés sus gustos y no hizo una petición concreta,
  podés preguntarle qué tipo de historias disfruta y devolver "books": [].

FORMATO:
Devolvé siempre un JSON válido con esta estructura:
{
  "reply": "Respuesta conversacional para el lector",
  "books": [
    {
      "title": "Título del libro",
      "author": "Autor",
      "genre": "Género",
      "description": "Descripción breve sin spoilers",
      "reason": "Por qué podría gustarle al lector"
    }
  ]
}

- El campo "reply" debe contener una introducción breve y natural.
- No incluyas saludos repetidos en "reply".
- Devolvé únicamente JSON válido, sin Markdown ni bloques de código.
                    `
                }
            });

            break;
        } catch (error) {
            console.error(
                `Error de Gemini en intento ${intento}:`,
                error.message
            );

            if (!esErrorTemporal(error) || intento === maxIntentos) {
                throw error;
            }

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

        resultado.books = resultado.books
            .filter(book => book && typeof book === "object")
            .map(book => ({
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
