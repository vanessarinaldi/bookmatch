
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages");
const newChatButton = document.getElementById("new-chat");

const STORAGE_KEY = "bookmatch_conversations_v1";
const ACTIVE_CHAT_KEY = "bookmatch_active_chat_v1";
const BOOK_IMAGE = "img/libro-corazon.png";

let conversations = loadConversations();
let currentChatId = localStorage.getItem(ACTIVE_CHAT_KEY);

// --------------------------------------------------
// ALMACENAMIENTO
// --------------------------------------------------

function loadConversations() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(saved) ? saved : [];
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
        alert("No se pudo guardar el chat. Puede que el almacenamiento esté lleno.");
    }
}

function getCurrentChat() {
    return conversations.find(chat => chat.id === currentChatId);
}

function createConversation() {
    const chat = {
        id: (
            crypto.randomUUID
                ? crypto.randomUUID()
                : Date.now().toString() + Math.random().toString(16).slice(2)
        ),
        title: "Nueva conversación",
        createdAt: new Date().toISOString(),
        messages: []
    };

    conversations.unshift(chat);
    currentChatId = chat.id;

    localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);

    saveConversations();
    renderConversation(chat);

    messageInput.focus();

    return chat;
}

// --------------------------------------------------
// GENERAR TÍTULOS AUTOMÁTICOS
// --------------------------------------------------

function generateChatTitle(message) {
    const text = (message || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[¿?¡!.,;:]/g, "")
        .trim();

    if (
        /^(hola|holaa*|buenas|buenos dias|buenas tardes|buenas noches|hey|hi|que tal|como estas)$/.test(text) ||
        text.split(/\s+/).length < 3
    ) {
        return null;
    }

    if (/harry potter/.test(text)) return "Aventuras mágicas";
    if (/fantasia|magia|magico|dragones|brujas/.test(text)) return "Fantasía y magia";
    if (/romance|romantico|romantica|amor|enamor/.test(text)) return "Libros románticos";
    if (/terror|miedo|suspenso|horror/.test(text)) return "Terror y suspenso";
    if (/misterio|detective|crimen|policial/.test(text)) return "Misterio y detectives";
    if (/triste|llorar|emocionante|drama/.test(text)) return "Historias emotivas";
    if (/aventura|aventuras|accion|viaje/.test(text)) return "Libros de aventuras";
    if (/ciencia ficcion|distopia|futurista|espacio/.test(text)) return "Ciencia ficción";
    if (/infantil|ninos|ninas/.test(text)) return "Lecturas infantiles";
    if (/autoayuda|motivacion|superacion/.test(text)) return "Libros de desarrollo personal";
    if (/historia real|biografia|autobiografia/.test(text)) return "Biografías e historias reales";
    if (/poesia|poemas/.test(text)) return "Poesía";
    if (/corto|cortos|rapido|rapida|pocas paginas/.test(text)) return "Libros cortos";
    if (/recomendame|recomiendame|recomendar|libros|leer|lectura/.test(text)) {
        return "Recomendaciones de libros";
    }

    return "Descubriendo libros";
}

function saveEntry(entry) {
    const chat = getCurrentChat();

    if (!chat) return;

    chat.messages.push(entry);

    if (
        entry.type === "message" &&
        entry.sender === "user" &&
        (
            chat.title === "Nueva conversación" ||
            chat.title === "Conversación sobre libros"
        )
    ) {
        const suggestedTitle = generateChatTitle(entry.text);

        if (suggestedTitle) {
            chat.title = suggestedTitle;
        }
    }

    saveConversations();
}

// --------------------------------------------------
// HISTORIAL DE CONVERSACIONES
// --------------------------------------------------

let historyContainer = document.getElementById("chat-history");

if (!historyContainer) {
    historyContainer = document.createElement("section");
    historyContainer.id = "chat-history";
    historyContainer.className = "chat-history";

    if (newChatButton && newChatButton.parentElement) {
        newChatButton.insertAdjacentElement("afterend", historyContainer);
    } else {
        document.body.prepend(historyContainer);
    }
}

function renderHistory() {
    if (!historyContainer) return;

    historyContainer.innerHTML = "";

    const title = document.createElement("h3");
    title.className = "chat-history-title";
    title.textContent = "Mis conversaciones";

    historyContainer.appendChild(title);

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
        openButton.textContent = "💬 " + chat.title;
        openButton.title = chat.title;

        openButton.addEventListener("click", () => {
            currentChatId = chat.id;

            localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);

            renderConversation(chat);
            renderHistory();
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

            conversations = conversations.filter(
                item => item.id !== chat.id
            );

            if (currentChatId === chat.id) {
                currentChatId = null;
            }

            if (conversations.length === 0) {
                currentChatId = null;
                localStorage.removeItem(ACTIVE_CHAT_KEY);

                saveConversations();
                createConversation();

                return;
            }

            if (!currentChatId) {
                currentChatId = conversations[0].id;

                localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);

                renderConversation(conversations[0]);
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
        if (!conversations.length) return;

        const confirmed = confirm(
            "¿Querés borrar todas las conversaciones? Esta acción no se puede deshacer."
        );

        if (!confirmed) return;

        conversations = [];
        currentChatId = null;

        localStorage.removeItem(ACTIVE_CHAT_KEY);

        saveConversations();
        createConversation();
    });

    historyContainer.appendChild(deleteAllButton);
}

// --------------------------------------------------
// IMAGEN DEL LIBRO CERRADO CON CORAZÓN
// --------------------------------------------------

function createBookHeartIcon() {
    const image = document.createElement("img");

    image.src = BOOK_IMAGE;
    image.alt = "Libro cerrado con un corazón rosa";

    return image;
}

// --------------------------------------------------
// MENSAJES Y BIENVENIDA
// --------------------------------------------------

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
    const welcome = messagesContainer.querySelector(".welcome");

    if (welcome) {
        welcome.remove();
    }

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

        const normalize = value =>
            (value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

        const wantedTitle = normalize(book.title);
        const wantedAuthor = normalize(book.author);

        const matchingBook = docs.find(item => {
            const titleMatches =
                normalize(item.title) === wantedTitle;

            const authors = (item.author_name || []).map(normalize);

            const authorMatches =
                !wantedAuthor ||
                authors.some(author =>
                    author.includes(wantedAuthor) ||
                    wantedAuthor.includes(author)
                );

            return titleMatches && authorMatches && item.cover_i;
        });

        const alternativeBook = matchingBook || docs.find(item =>
            normalize(item.title) === wantedTitle && item.cover_i
        );

        if (!alternativeBook) return null;

        return `https://covers.openlibrary.org/b/id/${alternativeBook.cover_i}-M.jpg`;
    } catch (error) {
        console.error("Error buscando portada alternativa:", error);
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

        // Contenedor independiente para mantener proporcionada la portada
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

        // Información del libro
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

    saveEntry({
        type: "books",
        books
    });

    renderBookCards(books);
}

// --------------------------------------------------
// RECUPERAR CONVERSACIONES
// --------------------------------------------------

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

// --------------------------------------------------
// CONSULTAR AL BACKEND
// --------------------------------------------------

async function sendMessage(message) {
    try {
        const response = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        console.log("Respuesta del backend:", data);

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Error al consultar el servidor"
            );
        }

        addMessage(
            data.response || "Encontré estas recomendaciones para vos.",
            "assistant"
        );

        addBookCards(data.books);
    } catch (error) {
        console.error("Error al comunicarse con el backend:", error);

        addMessage(
            "No pude obtener una respuesta. Revisá que el servidor esté activo e intentá de nuevo.",
            "assistant"
        );
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

    addMessage(text, "user");

    messageInput.value = "";
    messageInput.focus();

    await sendMessage(text);
});

newChatButton.addEventListener("click", createConversation);

// --------------------------------------------------
// INICIAR BOOKMATCH
// --------------------------------------------------

if (!getCurrentChat()) {
    currentChatId = conversations.length > 0
        ? conversations[0].id
        : null;

    if (currentChatId) {
        localStorage.setItem(ACTIVE_CHAT_KEY, currentChatId);
    }
}

if (getCurrentChat()) {
    renderConversation(getCurrentChat());
} else {
    showWelcome();
}

renderHistory();
