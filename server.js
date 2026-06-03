const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// servir arquivos da pasta public
app.use(express.static(path.join(__dirname, "public")));

// abrir index.html
app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("HELIX iniciado");
});
