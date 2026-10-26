
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");

const STORAGE_KEY = "bookmatch_conversations_v1";
const ACTIVE_CHAT_KEY = "bookmatch_active_chat_v1";
const BOOK_IMAGE = "img/libro-corazon.png";
const API_URL = "http://localhost:3000/api/chat";

let conversations = loadConversations();
let currentChatId = null;
let isSending = false;

function loadConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!Array.isArray(saved)) return [];

        return saved
            .filter(chat =>
                chat &&
                typeof chat.id === "string" &&
                Array.isArray(chat.messages)
            )
            .map(chat => ({
                ...chat,
                title: chat.title || "Nueva conversación",
                recommendedBooks: Array.isArray(chat.recommendedBooks)
                    ? chat.recommendedBooks
                    : []
            }));
    } catch (error) {
        console.error("No se pudo leer el historial:", error);
        return [];
    }
}

function saveConversations() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        renderHistory();
    } catch (error) {
        console.error("No se pudo guardar el historial:", error);
    }
}

function getCurrentChat() {
    return conversations.find(chat => chat.id === currentChatId);
}

function createConversation() {
    const id = typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const chat = {
        id,
        title: "Nueva conversación",
        createdAt: new Date().toISOString(),
        messages: [],
        recommendedBooks: []
    };

    conversations.unshift(chat);
    currentChatId = id;

    localStorage.setItem(ACTIVE_CHAT_KEY, id);
    saveConversations();
    renderConversation(chat);

    messageInput?.focus();
    return chat;
}

// HISTORIAL

let historyContainer = document.getElementById("chat-history");

if (!historyContainer) {
    historyContainer = document.createElement("section");
    historyContainer.id = "chat-history";
    historyContainer.className = "chat-history";

    if (newChatButton?.parentElement) {
        newChatButton.insertAdjacentElement("afterend", historyContainer);
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
        empty.textContent = "Todavía no tenés conversaciones guardadas.";
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
        openButton.textContent = `💬 ${chat.title}`;
        openButton.title = chat.title;

        openButton.addEventListener("click", () => {
            if (isSending) return;

            currentChatId = chat.id;
            localStorage.setItem(ACTIVE_CHAT_KEY, chat.id);
            renderConversation(chat);
            renderHistory();
            messageInput?.focus();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "chat-history-delete";
        deleteButton.textContent = "🗑️";
        deleteButton.title = "Borrar esta conversación";
        deleteButton.setAttribute("aria-label", "Borrar conversación");

        deleteButton.addEventListener("click", event => {
            event.stopPropagation();

            if (!confirm(`¿Querés borrar "${chat.title}"?`)) return;

            conversations = conversations.filter(item => item.id !== chat.id);

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
                const nextChat = conversations[0];
                currentChatId = nextChat.id;
                localStorage.setItem(ACTIVE_CHAT_KEY, nextChat.id);
                saveConversations();
                renderConversation(nextChat);
                return;
            }

            saveConversations();
        });

        item.append(openButton, deleteButton);
        historyContainer.appendChild(item);
    });

    const deleteAllButton = document.createElement("button");
    deleteAllButton.type = "button";
    deleteAllButton.className = "chat-history-delete-all";
    deleteAllButton.textContent = "Borrar todo el historial";

    deleteAllButton.addEventListener("click", () => {
        if (!conversations.length || isSending) return;

        if (!confirm(
            "¿Querés borrar todas las conversaciones? Esta acción no se puede deshacer."
        )) return;

        conversations = [];
        currentChatId = null;
        localStorage.removeItem(ACTIVE_CHAT_KEY);

        saveConversations();
        createConversation();
    });

    historyContainer.appendChild(deleteAllButton);
}

// MENSAJES

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
    heading.textContent = "¿Qué historia te gustaría descubrir?";

    const description = document.createElement("p");
    description.textContent =
        "Contame qué te gusta leer y encontremos juntos tu próximo libro favorito.";

    welcome.append(iconContainer, heading, description);
    messagesContainer.appendChild(welcome);
}

function renderMessage(text, sender) {
    messagesContainer.querySelector(".welcome")?.remove();

    const message = document.createElement("div");
    message.classList.add("message", sender);
    message.textContent = text;

    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addMessage(text, sender) {
    renderMessage(text, sender);
    saveEntry({ type: "message", text, sender });
}

function saveEntry(entry) {
    const chat = getCurrentChat();
    if (!chat) return;

    chat.messages.push(entry);
    saveConversations();
}

function getConversationHistory(chat) {
    if (!chat || !Array.isArray(chat.messages)) return [];

    return chat.messages
        .filter(entry =>
            entry.type === "message" &&
            typeof entry.text === "string" &&
            ["user", "assistant"].includes(entry.sender)
        )
        .slice(-20)
        .map(entry => ({
            role: entry.sender,
            content: entry.text
        }));
}

// TÍTULOS: SE FIJAN UNA SOLA VEZ

function normalizeText(text = "") {
    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[¿?¡!.,;:]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function createFallbackTitle(messages) {
    const userMessages = messages
        .filter(message => message.sender === "user")
        .map(message => message.text.trim())
        .filter(Boolean);

    const greetings = [
        "hola", "holaa", "holaaa", "holi", "buenas",
        "buen dia", "buenas tardes", "buenas noches",
        "gracias", "muchas gracias", "ok", "okay",
        "dale", "genial", "perfecto", "chau", "adios",
        "hasta luego"
    ];

    const meaningful = userMessages.filter(
        message => !greetings.includes(normalizeText(message))
    );

    if (!meaningful.length) return null;

    const text = normalizeText(meaningful.join(" "));
    let title = null;

    if (/sarah j maas/.test(text)) {
        title = "Libros de Sarah J. Maas";
    } else if (/colleen hoover/.test(text)) {
        title = "Libros de Colleen Hoover";
    } else if (/harry potter|jk rowling|j k rowling/.test(text)) {
        title = "Libros de Harry Potter";
    } else if (/rick riordan|percy jackson/.test(text)) {
        title = "Libros de Percy Jackson";
    } else if (/stephen king/.test(text)) {
        title = "Libros de Stephen King";
    } else if (/jane austen/.test(text)) {
        title = "Libros de Jane Austen";
    } else if (/fantasia romantica|romantasy|romance fantastico/.test(text)) {
        title = "Recomendaciones de fantasía romántica";
    } else if (/fantasia|fantastico|magia|dragones|brujas|hechizos/.test(text)) {
        title = "Recomendaciones de fantasía";
    } else if (/romance|romantico|romantica|historias de amor/.test(text)) {
        title = "Recomendaciones de romance";
    } else if (/misterio|detectives|investigacion/.test(text)) {
        title = "Recomendaciones de misterio";
    } else if (/terror|miedo|horror/.test(text)) {
        title = "Recomendaciones de terror";
    } else if (/suspenso|thriller|crimen/.test(text)) {
        title = "Libros de suspenso y misterio";
    } else if (/ciencia ficcion|distopia|distopico|espacio/.test(text)) {
        title = "Recomendaciones de ciencia ficción";
    } else if (/juvenil|young adult|adolescentes/.test(text)) {
        title = "Recomendaciones de literatura juvenil";
    } else if (/clasicos|literatura clasica/.test(text)) {
        title = "Recomendaciones de clásicos";
    } else if (/poesia|poemas/.test(text)) {
        title = "Recomendaciones de poesía";
    }

    if (!title) {
        title = meaningful[0].replace(/\s+/g, " ").trim();

        const words = title.split(/\s+/);
        if (words.length > 7) title = words.slice(0, 7).join(" ");
        if (title.length > 48) title = title.slice(0, 45).trimEnd() + "...";

        title = title.charAt(0).toLocaleUpperCase("es") + title.slice(1);
    }

    return title;
}

function updateContextualTitle(chatId) {
    const chat = conversations.find(item => item.id === chatId);

    if (!chat || chat.title !== "Nueva conversación") return;

    const title = createFallbackTitle(
        chat.messages
            .filter(entry => entry.type === "message")
            .map(entry => ({ sender: entry.sender, text: entry.text }))
    );

    if (title) {
        chat.title = title;
        saveConversations();
    }
}

// PORTADAS ALTERNATIVAS

async function findAlternativeCover(book) {
    try {
        const params = new URLSearchParams({
            title: book.title || "",
            limit: "10",
            fields: "cover_i,title,author_name"
        });

        if (book.author) params.set("author", book.author);

        const response = await fetch(
            `https://openlibrary.org/search.json?${params.toString()}`
        );

        if (!response.ok) return null;

        const data = await response.json();
        const docs = data.docs || [];

        const normalize = value =>
            (value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        const wantedTitle = normalize(book.title);
        const wantedAuthor = normalize(book.author);

        const matchingBook = docs.find(item => {
            const titleMatches = normalize(item.title) === wantedTitle;
            const authors = (item.author_name || []).map(normalize);

            const authorMatches = !wantedAuthor ||
                authors.some(author =>
                    author.includes(wantedAuthor) ||
                    wantedAuthor.includes(author)
                );

            return titleMatches && authorMatches && item.cover_i;
        });

        const alternativeBook = matchingBook ||
            docs.find(item =>
                normalize(item.title) === wantedTitle && item.cover_i
            );

        return alternativeBook
            ? `https://covers.openlibrary.org/b/id/${alternativeBook.cover_i}-M.jpg`
            : null;
    } catch (error) {
        console.error("Error buscando portada alternativa:", error);
        return null;
    }
}

// TARJETAS DE LIBROS

function createBookPlaceholder() {
    const placeholder = document.createElement("div");
    placeholder.className = "book-no-cover";

    const image = createBookHeartIcon();
    image.alt = "";

    placeholder.appendChild(image);
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", "Portada de libro no disponible");

    return placeholder;
}

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
            coverContainer.replaceChildren(createBookPlaceholder());
        }

        image.onerror = async () => {
            if (triedAlternative) {
                image.onerror = null;
                showPlaceholder();
                return;
            }

            triedAlternative = true;
            const alternativeCover = await findAlternativeCover(book);

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
        title.textContent = book.title || "Título no disponible";

        const author = document.createElement("p");
        author.className = "book-author";
        author.textContent = book.author || "Autor no disponible";

        const genre = document.createElement("span");
        genre.className = "book-genre";
        genre.textContent = book.genre || "Literatura";

        const description = document.createElement("p");
        description.className = "book-description";
        description.textContent = book.description || "";

        const reason = document.createElement("p");
        reason.className = "book-reason";
        reason.textContent = book.reason || "";

        details.append(title, author, genre, description, reason);
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

    const chat = getCurrentChat();
    if (!chat) return;

    const seen = new Set(
        (chat.recommendedBooks || []).map(book =>
            normalizeText(book.title).replace(/[^a-z0-9]/g, "")
        )
    );

    const uniqueBooks = books.filter(book => {
        const title = normalizeText(book.title).replace(/[^a-z0-9]/g, "");

        if (!title || seen.has(title)) return false;

        seen.add(title);
        return true;
    });

    if (!uniqueBooks.length) return;

    chat.recommendedBooks = [
        ...(chat.recommendedBooks || []),
        ...uniqueBooks.map(book => ({
            title: book.title,
            author: book.author
        }))
    ];

    chat.messages.push({
        type: "books",
        books: uniqueBooks
    });

    saveConversations();
    renderBookCards(uniqueBooks);
}

// RECUPERAR CONVERSACIÓN

function renderConversation(chat) {
    messagesContainer.innerHTML = "";

    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
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

// ENVIAR MENSAJES

async function sendMessage(message, chatId) {
    try {
        const chat = conversations.find(item => item.id === chatId);
        if (!chat) return;

        const conversationHistory = getConversationHistory(chat).slice(0, -1);

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                conversationHistory,
                excludedBooks: chat.recommendedBooks || []
            })
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error("El servidor devolvió una respuesta inválida.");
        }

        console.log("Respuesta del backend:", data);

        if (!response.ok) {
            throw new Error(data.message || "Error al consultar el servidor.");
        }

        if (currentChatId !== chatId) return;

        const reply = data.response || data.reply || data.message;

        if (reply) addMessage(reply, "assistant");

        if (Array.isArray(data.books)) {
            addBookCards(data.books);
        }
    } catch (error) {
        console.error("Error al comunicarse con BookMatch:", error);

        if (currentChatId === chatId) {
            addMessage(
                "No pude obtener una respuesta. Revisá tu conexión e intentá de nuevo.",
                "assistant"
            );
        }
    }
}

// EVENTOS

chatForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (isSending) return;

    const text = messageInput.value.trim();
    if (!text) return;

    if (!getCurrentChat()) createConversation();

    const chatId = currentChatId;
    const chat = conversations.find(item => item.id === chatId);
    if (!chat) return;

    isSending = true;
    messageInput.disabled = true;

    try {
        chat.messages.push({
            type: "message",
            text,
            sender: "user"
        });

        saveConversations();
        renderMessage(text, "user");
        messageInput.value = "";

        updateContextualTitle(chatId);
        await sendMessage(text, chatId);
    } finally {
        isSending = false;
        messageInput.disabled = false;

        if (currentChatId === chatId) {
            messageInput.focus();
        }
    }
});

newChatButton.addEventListener("click", () => {
    if (isSending) return;
    createConversation();
});

// INICIO: NUEVA CONVERSACIÓN AL ENTRAR, CONSERVARLA AL RECARGAR

const VISIT_CHAT_KEY = "bookmatch_visit_chat_v1";

function initializeBookMatch() {
    const visitChatId = sessionStorage.getItem(VISIT_CHAT_KEY);

    let activeChat = visitChatId
        ? conversations.find(chat => chat.id === visitChatId)
        : null;

    if (activeChat) {
        // Es la misma pestaña y la misma visita: restaurar el chat.
        currentChatId = activeChat.id;
        localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);
        renderConversation(activeChat);
    } else {
        // Es una visita nueva o el chat de esta visita ya no existe.
        createConversation();

        sessionStorage.setItem(VISIT_CHAT_KEY, currentChatId);
    }

    renderHistory();
}

initializeBookMatch();