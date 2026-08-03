import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return <main><p className="eyebrow">Authenticated application</p><h1>{{PROJECT_NAME}}</h1><p>{{PROJECT_DESCRIPTION}}</p></main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
