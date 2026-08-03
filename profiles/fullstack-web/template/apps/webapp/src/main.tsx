import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
{{SLOT:WEBAPP_IMPORTS}}

function App() {
  return <main><p className="eyebrow">Authenticated application</p><h1>{{PROJECT_NAME}}</h1><p>{{PROJECT_DESCRIPTION}}</p>{{SLOT:WEBAPP_BODY}}</main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
