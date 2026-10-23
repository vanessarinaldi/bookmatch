require("dotenv").config();

const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chat.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Backend Chat IA funcionando"
    });
});

app.use("/api/chat", chatRoutes);

// En Vercel se exporta la aplicación.
// En local se inicia el servidor normalmente.
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
}

module.exports = app;