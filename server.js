const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// página principal
app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// LOGIN
app.post("/api/login", (req, res) => {

  const {
    email,
    password
  } = req.body;

  // login temporário
  if (
    email === "admin@gmail.com" &&
    password === "123"
  ) {

    return res.json({
      success: true,
      token: "helix_token"
    });

  }

  return res
    .status(401)
    .json({
      error:
      "Email ou senha incorretos"
    });

});

// REGISTER
app.post("/api/register", (req, res) => {

  const {
    email,
    password
  } = req.body;

  if (
    !email ||
    !password
  ) {
    return res
      .status(400)
      .json({
        error:
        "Preencha os campos"
      });
  }

  return res.json({
    success: true
  });

});

// DASHBOARD
app.get(
"/dashboard",
(req,res)=>{

res.sendFile(
path.join(
__dirname,
"public",
"dashboard.html"
)

);

}
);

app.listen(
PORT,
"0.0.0.0",
()=>{

console.log(
`HELIX rodando na porta ${PORT}`
);

}
);
