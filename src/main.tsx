import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.js";
import { PersonalAtlas } from "./app/PersonalAtlas.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Atlas root is missing");

createRoot(root).render(
  <StrictMode>{import.meta.env.MODE === "worker" ? <PersonalAtlas /> : <App />}</StrictMode>,
);
