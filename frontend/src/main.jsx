import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { Toaster } from "react-hot-toast";

import "./index.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>

    <BrowserRouter>

      <App />

      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0f172a",
            color: "#ffffff",
            border: "1px solid rgba(14,165,233,0.25)"
          },
          success: {
            duration: 3000,
          },
          error: {
            duration: 5000,
          },
        }}
      />

    </BrowserRouter>

  </React.StrictMode>
);