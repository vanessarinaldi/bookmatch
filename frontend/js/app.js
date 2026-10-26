
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");

const STORAGE_KEY = "bookmatch_conversations_v1";
const ACTIVE_CHAT_KEY = "bookmatch_active_chat_v1";
const BOOK_IMAGE = "img/libro-corazon.png";
const API_URL = "https://bookmatch-api.vercel.app/api/chat";

let conversations = loadConversations();
let currentChatId = null;

const chatsGeneratingTitle = new Set();

// --------------------------------------------------
// ALMACENAMIENTO
// --------------------------------------------------

function loadConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!Array.isArray(saved)) return [];

        return saved.filter(
            chat =>
                chat &&
                typeof chat.id === "string" &&
                Array.isArray(chat.messages)
        );
    } catch (error) {
        console.error("No se pudo leer el historial:", error);
        return [];
    }
}

function saveConversations() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(conversations)
        );

        renderHistory();
    } catch (error) {
        console.error("No se pudo guardar el historial:", error);
    }
}

function getCurrentChat() {
    return conversations.find(chat => chat.id === currentChatId);
}

// --------------------------------------------------
// CREAR CONVERSACIÓN
// --------------------------------------------------

function createConversation() {
    const id =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Date.now().toString() +
              Math.random().toString(16).slice(2);

    const chat = {
        id,
        title: "Nueva conversación",
        createdAt: new Date().toISOString(),
        messages: []
    };

    conversations.unshift(chat);
    currentChatId = chat.id;

    localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);

    saveConversations();
    renderConversation(chat);

    if (messageInput) {
        messageInput.focus();
    }

    return chat;
}

// --------------------------------------------------
// HISTORIAL
// --------------------------------------------------

let historyContainer = document.getElementById("chat-history");

if (!historyContainer) {
    historyContainer = document.createElement("section");
    historyContainer.id = "chat-history";
    historyContainer.className = "chat-history";

    if (newChatButton && newChatButton.parentElement) {
        newChatButton.insertAdjacentElement(
            "afterend",
            historyContainer
        );
    } else {
        document.body.prepend(historyContainer);
    }
}

function renderHistory() {
    if (!historyContainer) return;

    historyContainer.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "chat-history-title";
    heading.textContent = "Mis conversaciones";

    historyContainer.appendChild(heading);

    if (conversations.length === 0) {
        const empty = document.createElement("p");
        empty.className = "chat-history-empty";
        empty.textContent =
            "Todavía no tenés conversaciones guardadas.";

        historyContainer.appendChild(empty);
        return;
    }

    conversations.forEach(chat => {
        const item = document.createElement("div");
        item.className = "chat-history-item";

        if (chat.id === currentChatId) {
            item.classList.add("active");
        }

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "chat-history-open";
        openButton.textContent = "💬 " + chat.title;
        openButton.title = chat.title;

        openButton.addEventListener("click", () => {
            currentChatId = chat.id;

            localStorage.setItem(
                ACTIVE_CHAT_KEY,
                currentChatId
            );

            renderConversation(chat);
            renderHistory();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "chat-history-delete";
        deleteButton.textContent = "🗑️";
        deleteButton.title = "Borrar esta conversación";
        deleteButton.setAttribute(
            "aria-label",
            "Borrar conversación"
        );

        deleteButton.addEventListener("click", event => {
            event.stopPropagation();

            if (!confirm(`¿Querés borrar "${chat.title}"?`)) {
                return;
            }

            chatsGeneratingTitle.delete(chat.id);

            conversations = conversations.filter(
                conversation => conversation.id !== chat.id
            );

            if (currentChatId === chat.id) {
                currentChatId = null;
            }

            if (conversations.length === 0) {
                localStorage.removeItem(ACTIVE_CHAT_KEY);
                saveConversations();
                createConversation();
                return;
            }

            if (!currentChatId) {
                currentChatId = conversations[0].id;

                localStorage.setItem(
                    ACTIVE_CHAT_KEY,
                    currentChatId
                );

                renderConversation(conversations[0]);
            }

            saveConversations();
            renderHistory();
        });

        item.append(openButton, deleteButton);
        historyContainer.appendChild(item);
    });

    const deleteAllButton = document.createElement("button");
    deleteAllButton.type = "button";
    deleteAllButton.className = "chat-history-delete-all";
    deleteAllButton.textContent = "Borrar todo el historial";

    deleteAllButton.addEventListener("click", () => {
        if (!conversations.length) return;

        const confirmed = confirm(
            "¿Querés borrar todas las conversaciones? " +
            "Esta acción no se puede deshacer."
        );

        if (!confirmed) return;

        chatsGeneratingTitle.clear();
        conversations = [];
        currentChatId = null;

        localStorage.removeItem(ACTIVE_CHAT_KEY);

        saveConversations();
        createConversation();
    });

    historyContainer.appendChild(deleteAllButton);
}

// --------------------------------------------------
// MENSAJES Y BIENVENIDA
// --------------------------------------------------

function createBookHeartIcon() {
    const image = document.createElement("img");
    image.src = BOOK_IMAGE;
    image.alt = "Libro cerrado con un corazón rosa";

    return image;
}

function showWelcome() {
    messagesContainer.innerHTML = "";

    const welcome = document.createElement("div");
    welcome.className = "welcome";

    const iconContainer = document.createElement("div");
    iconContainer.className = "welcome-icon";
    iconContainer.setAttribute("aria-hidden", "true");
    iconContainer.appendChild(createBookHeartIcon());

    const heading = document.createElement("h2");
    heading.textContent =
        "¿Qué historia te gustaría descubrir?";

    const description = document.createElement("p");
    description.textContent =
        "Contame qué te gusta leer y encontremos juntos " +
        "tu próximo libro favorito.";

    welcome.append(iconContainer, heading, description);
    messagesContainer.appendChild(welcome);
}

function renderMessage(text, sender) {
    const welcome = messagesContainer.querySelector(".welcome");

    if (welcome) welcome.remove();

    const message = document.createElement("div");
    message.classList.add("message", sender);
    message.textContent = text;

    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addMessage(text, sender) {
    renderMessage(text, sender);

    saveEntry({
        type: "message",
        text,
        sender
    });
}

// --------------------------------------------------
// GUARDAR MENSAJES
// --------------------------------------------------

function saveEntry(entry) {
    const chat = getCurrentChat();

    if (!chat) return;

    chat.messages.push(entry);
    saveConversations();
}

// --------------------------------------------------
// CONSTRUIR EL CONTEXTO PARA GEMINI
// --------------------------------------------------

function getConversationHistory(chat) {
    if (!chat || !Array.isArray(chat.messages)) return [];

    return chat.messages
        .filter(
            entry =>
                entry.type === "message" &&
                typeof entry.text === "string" &&
                ["user", "assistant"].includes(entry.sender)
        )
        .slice(-12)
        .map(entry => ({
            role: entry.sender,
            content: entry.text
        }));
}

// --------------------------------------------------
// TÍTULOS DE CONVERSACIÓN
// --------------------------------------------------

function createFallbackTitle(messages) {
    const firstUserMessage = messages.find(
        message => message.sender === "user"
    );

    if (!firstUserMessage) return null;

    let title = firstUserMessage.text
        .replace(/\s+/g, " ")
        .trim();

    // No generar títulos a partir de saludos aislados.
    const normalized = title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[¿?¡!.,]/g, "")
        .trim();

    const greetings = [
        "hola",
        "holaa",
        "holi",
        "buenas",
        "buen dia",
        "buenas tardes",
        "buenas noches",
        "gracias",
        "chau",
        "adios"
    ];

    if (greetings.includes(normalized)) {
        return null;
    }

    const words = title.split(/\s+/);

    if (words.length > 6) {
        title = words.slice(0, 6).join(" ");
    }

    if (title.length > 45) {
        title = title.slice(0, 42).trimEnd() + "...";
    }

    return title.charAt(0).toLocaleUpperCase("es") +
        title.slice(1);
}

async function generateContextualTitle(messages) {
    const conversationText = messages
        .map(message =>
            `${message.sender === "user" ? "Usuario" : "BookMatch"}: ${message.text}`
        )
        .join("\n");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message:
                    "Creá un título breve para esta conversación. " +
                    "No recomiendes libros ni saludes. " +
                    "Respondé solamente con un título de 2 a 6 palabras. " +
                    "Si solo hay saludos sin tema, respondé SIN_TITULO.\n\n" +
                    conversationText
            })
        });

        if (!response.ok) return null;

        const data = await response.json();

        // La API devuelve un objeto de chat, no texto plano.
        const rawTitle = String(
            data.response || data.reply || ""
        ).trim();

        if (!rawTitle || /SIN_TITULO/i.test(rawTitle)) {
            return null;
        }

        const cleanedTitle = rawTitle
            .replace(/^["'“”]+|["'“”]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const words = cleanedTitle.split(/\s+/);

        if (
            !cleanedTitle ||
            words.length > 8 ||
            cleanedTitle.length > 70
        ) {
            return null;
        }

        return cleanedTitle;
    } catch (error) {
        console.error(
            "Error generando título contextual:",
            error
        );

        return null;
    }
}

async function updateContextualTitle(chatId) {
    const chat = conversations.find(
        item => item.id === chatId
    );

    if (!chat || chat.title !== "Nueva conversación") return;

    if (chatsGeneratingTitle.has(chatId)) return;

    const messagesSnapshot = chat.messages
        .filter(entry => entry.type === "message")
        .map(entry => ({
            sender: entry.sender,
            text: entry.text
        }));

    const userMessages = messagesSnapshot.filter(
        message => message.sender === "user"
    );

    if (userMessages.length === 0) return;

    chatsGeneratingTitle.add(chatId);

    try {
        // Primero intentamos obtener un título contextual.
        let title = await generateContextualTitle(messagesSnapshot);

        // Si Gemini no devuelve un título útil, usamos el primer mensaje.
        if (!title) {
            title = createFallbackTitle(messagesSnapshot);
        }

        const latestChat = conversations.find(
            item => item.id === chatId
        );

        if (
            title &&
            latestChat &&
            latestChat.title === "Nueva conversación"
        ) {
            latestChat.title = title;
            saveConversations();
        }
    } finally {
        chatsGeneratingTitle.delete(chatId);
    }
}

// --------------------------------------------------
// PORTADAS DE LIBROS
// --------------------------------------------------

function createBookPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "book-no-cover";

    const image = createBookHeartIcon();
    image.alt = "";

    placeholder.appendChild(image);
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute(
        "aria-label",
        "Portada de libro no disponible"
    );

    return placeholder;
}

async function findAlternativeCover(book) {
    try {
        const params = new URLSearchParams({
            title: book.title || "",
            limit: "10",
            fields: "cover_i,title,author_name"
        });

        if (book.author) {
            params.set("author", book.author);
        }

        const response = await fetch(
            `https://openlibrary.org/search.json?${params.toString()}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        const docs = data.docs || [];

        const normalizeText = value =>
            (value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        const wantedTitle = normalizeText(book.title);
        const wantedAuthor = normalizeText(book.author);

        const matchingBook = docs.find(item => {
            const titleMatches =
                normalizeText(item.title) === wantedTitle;

            const authors = (item.author_name || [])
                .map(normalizeText);

            const authorMatches =
                !wantedAuthor ||
                authors.some(author =>
                    author.includes(wantedAuthor) ||
                    wantedAuthor.includes(author)
                );

            return titleMatches && authorMatches && item.cover_i;
        });

        const alternativeBook =
            matchingBook ||
            docs.find(item =>
                normalizeText(item.title) === wantedTitle &&
                item.cover_i
            );

        if (!alternativeBook) return null;

        return (
            `https://covers.openlibrary.org/b/id/` +
            `${alternativeBook.cover_i}-M.jpg`
        );
    } catch (error) {
        console.error(
            "Error buscando portada alternativa:",
            error
        );

        return null;
    }
}

// --------------------------------------------------
// TARJETAS DE LIBROS
// --------------------------------------------------

function renderBookCards(books) {
    if (!Array.isArray(books) || books.length === 0) return;

    const container = document.createElement("div");
    container.className = "book-grid";

    books.forEach(book => {
        const card = document.createElement("article");
        card.className = "book-card";

        const coverContainer = document.createElement("div");
        coverContainer.className = "book-cover";

        const image = document.createElement("img");
        image.className = "book-cover-image";
        image.alt = `Portada de ${book.title || "libro"}`;
        image.loading = "lazy";

        let triedAlternative = false;

        function showPlaceholder() {
            if (!coverContainer.isConnected) return;

            coverContainer.replaceChildren(
                createBookPlaceholder()
            );
        }

        image.onerror = async () => {
            if (triedAlternative) {
                image.onerror = null;
                showPlaceholder();
                return;
            }

            triedAlternative = true;

            const alternativeCover =
                await findAlternativeCover(book);

            if (alternativeCover && image.isConnected) {
                image.src = alternativeCover;
            } else if (image.isConnected) {
                image.onerror = null;
                showPlaceholder();
            }
        };

        coverContainer.appendChild(image);

        if (book.cover) {
            image.src = book.cover;
        } else {
            triedAlternative = true;

            findAlternativeCover(book).then(cover => {
                if (!image.isConnected) return;

                if (cover) {
                    image.src = cover;
                } else {
                    showPlaceholder();
                }
            });
        }

        const details = document.createElement("div");
        details.className = "book-details";

        const title = document.createElement("h3");
        title.textContent =
            book.title || "Título no disponible";

        const author = document.createElement("p");
        author.className = "book-author";
        author.textContent =
            book.author || "Autor no disponible";

        const genre = document.createElement("span");
        genre.className = "book-genre";
        genre.textContent = book.genre || "Literatura";

        const description = document.createElement("p");
        description.className = "book-description";
        description.textContent = book.description || "";

        const reason = document.createElement("p");
        reason.className = "book-reason";
        reason.textContent = book.reason || "";

        details.append(
            title,
            author,
            genre,
            description,
            reason
        );

        card.append(coverContainer, details);

        if (book.previewLink) {
            const link = document.createElement("a");
            link.href = book.previewLink;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Ver libro";

            card.appendChild(link);
        }

        container.appendChild(card);
    });

    messagesContainer.appendChild(container);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addBookCards(books) {
    if (!Array.isArray(books) || books.length === 0) return;

    saveEntry({
        type: "books",
        books
    });

    renderBookCards(books);
}

// --------------------------------------------------
// RECUPERAR CONVERSACIÓN
// --------------------------------------------------

function renderConversation(chat) {
    messagesContainer.innerHTML = "";

    if (
        !chat ||
        !Array.isArray(chat.messages) ||
        chat.messages.length === 0
    ) {
        showWelcome();
        return;
    }

    chat.messages.forEach(entry => {
        if (entry.type === "message") {
            renderMessage(entry.text, entry.sender);
        } else if (entry.type === "books") {
            renderBookCards(entry.books);
        }
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --------------------------------------------------
// ENVIAR MENSAJES AL BACKEND
// --------------------------------------------------

async function sendMessage(message, chatId) {
    try {
        const chat = conversations.find(
            item => item.id === chatId
        );

        if (!chat) return;

        // Enviar los mensajes anteriores, sin duplicar el actual.
        const conversationHistory = getConversationHistory(chat)
            .slice(0, -1);

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                conversationHistory
            })
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "El servidor devolvió una respuesta inválida."
            );
        }

        console.log("Respuesta del backend:", data);

        if (!response.ok) {
            throw new Error(
                data.message || "Error al consultar el servidor."
            );
        }

        const reply =
            data.response || data.reply || data.message;

        // Si se cambió de conversación, no mostrar la respuesta en otra.
        if (currentChatId !== chatId) return;

        if (reply) {
            addMessage(reply, "assistant");
        }

        if (Array.isArray(data.books)) {
            addBookCards(data.books);
        }

        await updateContextualTitle(chatId);
    } catch (error) {
        console.error(
            "Error al comunicarse con BookMatch:",
            error
        );

        if (currentChatId === chatId) {
            addMessage(
                "No pude obtener una respuesta. Revisá tu conexión e intentá de nuevo.",
                "assistant"
            );
        }
    }
}

// --------------------------------------------------
// EVENTOS
// --------------------------------------------------

chatForm.addEventListener("submit", async event => {
    event.preventDefault();

    const text = messageInput.value.trim();

    if (!text) return;

    if (!getCurrentChat()) {
        createConversation();
    }

    const chatId = currentChatId;
    const chat = conversations.find(
        item => item.id === chatId
    );

    if (!chat) return;

    chat.messages.push({
        type: "message",
        text,
        sender: "user"
    });

    saveConversations();
    renderMessage(text, "user");

    messageInput.value = "";
    messageInput.focus();

    await sendMessage(text, chatId);
});

newChatButton.addEventListener("click", () => {
    createConversation();
});

// --------------------------------------------------
// INICIAR BOOKMATCH
// --------------------------------------------------

function initializeBookMatch() {
    const savedActiveChatId =
        localStorage.getItem(ACTIVE_CHAT_KEY);

    let activeChat = conversations.find(
        chat => chat.id === savedActiveChatId
    );

    // Si el chat activo no existe, recuperar el más reciente.
    if (!activeChat && conversations.length > 0) {
        activeChat = conversations[0];
    }

    // Crear conversación solamente si no hay ninguna guardada.
    if (!activeChat) {
        createConversation();
        return;
    }

    currentChatId = activeChat.id;

    localStorage.setItem(
        ACTIVE_CHAT_KEY,
        currentChatId
    );

    renderConversation(activeChat);
    renderHistory();
}

initializeBookMatch();
