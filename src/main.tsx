import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { aplicarTema, leerTema } from "./lib/tema";
import "./estilos.css";

// Antes del primer render, para que no parpadee el tema equivocado.
aplicarTema(leerTema());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
