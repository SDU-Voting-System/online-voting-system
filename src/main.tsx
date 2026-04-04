import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Build version for deployment tracking
const BUILD_VERSION = __VITE_BUILD_TIMESTAMP__ || new Date().toISOString();
console.log('🚀 SDU Online Voting System loaded');
console.log('📦 Build version:', BUILD_VERSION);
console.log('🌐 Base path:', import.meta.env.BASE_URL);

createRoot(document.getElementById("root")!).render(<App />);
